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
      projectName?: string
      manuscript: unknown[] | null
      storyBible: unknown[] | null
      storyBrain: unknown[] | null
      arcSeeds: unknown[] | null
      referenceLibrary: unknown[] | null
      nameForgeData: unknown[] | Record<string, unknown> | null
      exportHistory: Record<string, unknown> | null
      volumes: unknown[] | null
      bibleGroups: unknown[] | null
      progressionProfiles: unknown[] | null
      progressionSystem: unknown | null
    }
  }
  settings: {
    theme: string
    leftSidebarWidth: number
  }
}

export async function createBackup(projectIds: string[], userId?: string): Promise<BackupData> {
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

    let projectName: string | undefined
    let volumes: unknown[] | null = null
    let bibleGroups: unknown[] | null = null
    let progressionProfiles: unknown[] | null = null
    let progressionSystem: unknown | null = null

    try {
      if (userId) {
        const stored = localStorage.getItem(`penpad_projects_${userId}`)
        if (stored) {
          const projectsList = JSON.parse(stored)
          const match = projectsList.find((p: { id: string, name: string }) => p.id === projectId)
          if (match) projectName = match.name
        }
      }
    } catch { /* ignore */ }

    try {
      const v = localStorage.getItem(`penpad_volumes_${projectId}`)
      if (v) volumes = JSON.parse(v)
    } catch { /* ignore */ }
    try {
      const g = localStorage.getItem(`penpad_bible_groups_${projectId}`)
      if (g) bibleGroups = JSON.parse(g)
    } catch { /* ignore */ }
    try {
      const p = localStorage.getItem(`penpad_progression_${projectId}`)
      if (p) progressionProfiles = JSON.parse(p)
    } catch { /* ignore */ }
    try {
      const s = localStorage.getItem(`penpad_progression_system_${projectId}`)
      if (s) progressionSystem = JSON.parse(s)
    } catch { /* ignore */ }

    projects[projectId] = {
      projectName,
      manuscript,
      storyBible: bible,
      storyBrain: brain,
      arcSeeds: arcs,
      referenceLibrary: refs,
      nameForgeData: names ? [names] : null,
      exportHistory: exports,
      volumes,
      bibleGroups,
      progressionProfiles,
      progressionSystem
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

export async function restoreBackup(data: BackupData, userId?: string): Promise<string[]> {
  const restored: string[] = []
  const restoredProjectRecords: Array<{
    id: string
    name: string
    lastUpdated: number
    volumes: unknown[]
    bibleGroups: unknown[]
    progressionProfiles: unknown[]
    progressionSystem: unknown | null
  }> = []

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
      const raw = Array.isArray(projectData.nameForgeData)
        ? projectData.nameForgeData[0] as Record<string, unknown> | undefined
        : projectData.nameForgeData as Record<string, unknown>
      if (raw) {
      ops.push(saveNameForgeDataLocal(projectId, {
        shortlist: (raw.shortlist as unknown[]) ?? [],
        presets: (raw.presets as unknown[]) ?? [],
        generationHistory: (raw.generationHistory as unknown[]) ?? [],
        nameRatings: (raw.nameRatings as Record<string, unknown>) ?? {}
      }))
      }
    }
    if (projectData.exportHistory) {
      ops.push(saveExportHistoryLocal(projectId, projectData.exportHistory as Record<string, unknown>))
    }

    await Promise.all(ops)
    restored.push(projectId)

    if (projectData.volumes) {
      localStorage.setItem(`penpad_volumes_${projectId}`, JSON.stringify(projectData.volumes))
    }
    if (projectData.bibleGroups) {
      localStorage.setItem(`penpad_bible_groups_${projectId}`, JSON.stringify(projectData.bibleGroups))
    }
    if (projectData.progressionProfiles) {
      localStorage.setItem(`penpad_progression_${projectId}`, JSON.stringify(projectData.progressionProfiles))
    }
    if (projectData.progressionSystem) {
      localStorage.setItem(`penpad_progression_system_${projectId}`, JSON.stringify(projectData.progressionSystem))
    }

    restoredProjectRecords.push({
      id: projectId,
      name: projectData.projectName || projectId,
      lastUpdated: Date.now(),
      volumes: Array.isArray(projectData.volumes) ? projectData.volumes : [],
      bibleGroups: Array.isArray(projectData.bibleGroups) ? projectData.bibleGroups : [],
      progressionProfiles: Array.isArray(projectData.progressionProfiles) ? projectData.progressionProfiles : [],
      progressionSystem: projectData.progressionSystem || null
    })
  }

  if (userId && restoredProjectRecords.length > 0) {
    const key = `penpad_projects_${userId}`
    let projects: Array<Record<string, unknown> & { id: string }> = []
    try {
      const stored = localStorage.getItem(key)
      projects = stored ? JSON.parse(stored) : []
      if (!Array.isArray(projects)) projects = []
    } catch {
      projects = []
    }

    for (const restoredProject of restoredProjectRecords) {
      const idx = projects.findIndex(project => project.id === restoredProject.id)
      const nextProject = {
        ...(idx >= 0 ? projects[idx] : {}),
        ...restoredProject
      }
      if (idx >= 0) projects[idx] = nextProject
      else projects.unshift(nextProject)
    }

    localStorage.setItem(key, JSON.stringify(projects))
  }

  if (data.settings?.theme) {
    localStorage.setItem('penpad_theme', data.settings.theme)
    document.documentElement.className = data.settings.theme
  }
  if (Number.isFinite(Number(data.settings?.leftSidebarWidth))) {
    localStorage.setItem('penpad_left_sidebar_width', String(data.settings.leftSidebarWidth))
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
        const data = JSON.parse(e.target?.result as string)
        if (!data || typeof data !== 'object' || !data.projects || typeof data.projects !== 'object') {
          throw new Error('Missing "projects" root key')
        }
        resolve(data as BackupData)
      } catch (err) {
        reject(new Error(err instanceof SyntaxError ? 'Invalid backup file' : err instanceof Error ? err.message : 'Unknown error'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
