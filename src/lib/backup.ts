import {
  getManuscriptLocal, getStoryBibleLocal, getStoryBrainLocal,
  getArcSeedsLocal, getReferenceLibraryLocal, getNameForgeDataLocal,
  saveManuscriptLocal, saveStoryBibleLocal, saveStoryBrainLocal,
  saveArcSeedsLocal, saveReferenceLibraryLocal, saveNameForgeDataLocal,
  getExportHistoryLocal, saveExportHistoryLocal
} from './db'

export interface BackupData {
  version: number
  createdAt: string
  appVersion: string
  projects: {
    [projectId: string]: {
      manuscript: unknown[] | null
      storyBible: unknown[] | null
      storyBrain: unknown[] | null
      arcSeeds: unknown[] | null
      referenceLibrary: unknown[] | null
      nameForgeData: unknown[] | null
      exportHistory: Record<string, unknown> | null
    }
  }
  settings: {
    theme: string
    leftSidebarWidth: number
  }
}

export async function createBackup(projectIds: string[]): Promise<BackupData> {
  const projects: BackupData['projects'] = {}

  for (const projectId of projectIds) {
    const [manuscript, bible, brain, arcs, refs, names, exports] = await Promise.all([
      getManuscriptLocal(projectId),
      getStoryBibleLocal(projectId),
      getStoryBrainLocal(projectId),
      getArcSeedsLocal(projectId),
      getReferenceLibraryLocal(projectId),
      getNameForgeDataLocal(projectId),
      getExportHistoryLocal(projectId)
    ])

    projects[projectId] = {
      manuscript,
      storyBible: bible,
      storyBrain: brain,
      arcSeeds: arcs,
      referenceLibrary: refs,
      nameForgeData: names ? [names] : null,
      exportHistory: exports
    }
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    appVersion: '0.1.0',
    projects,
    settings: {
      theme: localStorage.getItem('penpad_theme') || 'theme-midnight',
      leftSidebarWidth: Number(localStorage.getItem('penpad_left_sidebar_width')) || 300
    }
  }
}

export async function restoreBackup(data: BackupData): Promise<string[]> {
  const restored: string[] = []

  for (const [projectId, projectData] of Object.entries(data.projects)) {
    const ops: Promise<void>[] = []

    if (projectData.manuscript) {
      ops.push(saveManuscriptLocal(projectId, projectData.manuscript))
    }
    if (projectData.storyBible) {
      ops.push(saveStoryBibleLocal(projectId, projectData.storyBible))
    }
    if (projectData.storyBrain) {
      ops.push(saveStoryBrainLocal(projectId, projectData.storyBrain))
    }
    if (projectData.arcSeeds) {
      ops.push(saveArcSeedsLocal(projectId, projectData.arcSeeds))
    }
    if (projectData.referenceLibrary) {
      ops.push(saveReferenceLibraryLocal(projectId, projectData.referenceLibrary))
    }
    if (projectData.nameForgeData) {
      ops.push(saveNameForgeDataLocal(projectId, { shortlist: [], presets: [], generationHistory: [], nameRatings: {} }))
    }
    if (projectData.exportHistory) {
      ops.push(saveExportHistoryLocal(projectId, projectData.exportHistory as Record<string, unknown>))
    }

    await Promise.all(ops)
    restored.push(projectId)
  }

  if (data.settings?.theme) {
    localStorage.setItem('penpad_theme', data.settings.theme)
    document.documentElement.className = data.settings.theme
  }

  return restored
}

export function downloadBackup(data: BackupData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `penpad-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function readBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as BackupData
        resolve(data)
      } catch {
        reject(new Error('Invalid backup file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
