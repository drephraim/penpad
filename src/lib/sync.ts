import { saveManuscriptLocal, saveStoryBibleLocal, saveStoryBrainLocal, saveReferenceLibraryLocal, saveNameForgeDataLocal, type NameForgeData } from "./db"

export interface Project {
  id: string
  name: string
  lastUpdated?: number
  volumes?: unknown[]
  bibleGroups?: unknown[]
  progressionProfiles?: unknown[]
  progressionSystem?: unknown
}

export interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  isMemories?: boolean
  wordGoal?: number
  volumeId?: string | null
  sortOrder?: number
}

export interface BibleEntry {
  id: string
  name: string
  category: "character" | "world" | "beast" | "place" | "item"
  content: string
  groupIds?: string[]
  timelineFacts?: BibleTimelineFact[]
  characterDetails?: BibleCharacterDetails
  createdAt: number
  updatedAt: number
}

export interface ProjectDatabaseImport {
  project: Project | null
  chapters: Note[]
  bibleEntries: BibleEntry[]
  brainEntries: BrainEntry[]
  arcSeeds: ArcSeed[]
  progressionProfiles: unknown[]
  progressionSystem: unknown | null
  referenceLibrary: unknown[]
  nameForgeData: Record<string, unknown>
  importedAt: number
}

export interface BibleCharacterDetails {
  appearance?: string
  attire?: string
  hair?: string
  eyes?: string
  body?: string
  distinguishingFeatures?: string
  weapon?: string
  height?: string
  age?: string
  chapterAppearances?: BibleCharacterAppearanceFact[]
  updatedAt?: number
}

export interface BibleCharacterAppearanceFact {
  id: string
  chapterId: string
  chapterTitle: string
  chapterNumber?: number | null
  summary: string
  evidence?: string
  appearance?: string
  attire?: string
  hair?: string
  eyes?: string
  body?: string
  height?: string
  age?: string
  distinguishingFeatures?: string
  weapon?: string
  createdAt: number
}

export interface BibleTimelineFact {
  id: string
  chapterId: string
  chapterTitle: string
  chapterNumber?: number | null
  summary: string
  evidence?: string
  status?: string
  createdAt: number
}

export interface BrainEntry {
  id: string
  highlightedText: string
  aiSummary: string
  chapterTitle: string
  chapterId: string
  chapterNumber?: number
  entityType?: "character" | "place" | "object" | "concept" | "event" | "foreshadowing" | "unknown"
  entityName?: string
  importance?: "minor" | "major" | "critical"
  connections?: string[]
  createdAt: number
  updatedAt: number
}

export type ArcSeedStatus = "open" | "developing" | "paid_off" | "dropped"

export interface ArcSeed {
  id: string
  title: string
  summary: string
  whyItMatters: string
  futurePayoff: string
  evidence: string
  chapterTitle: string
  chapterId: string
  chapterNumber?: number | null
  relatedCharacters?: string[]
  relatedEntities?: string[]
  status: ArcSeedStatus
  createdAt: number
  updatedAt: number
}

/**
 * Helper to execute a fetch request with a timeout.
 */
async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 15000, ...fetchOptions } = options
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    throw error
  }
}

/**
 * Reconciles local projects with PostgreSQL via Next.js API.
 * - If only local: uploads to Postgres.
 * - If only in cloud: downloads to local.
 * - If in both: compares lastUpdated timestamp, uploads/downloads the newer version.
 */
export async function syncProjectsWithCloud(userId: string, localProjects: Project[]): Promise<Project[]> {
  if (!userId) return localProjects

  try {
    const response = await fetchWithTimeout("/api/sync/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, localProjects })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const merged = (data.projects || []) as Project[]

    // Cache the reconciled projects locally
    localStorage.setItem(`penpad_projects_${userId}`, JSON.stringify(merged))
    return merged
  } catch (error) {
    console.error("Failed to sync projects with cloud, falling back to local:", error)
    return localProjects
  }
}

/**
 * Pulls a project from PostgreSQL without reconciling local state back into the database.
 */
export async function importProjectDataFromCloud(userId: string, projectId: string): Promise<ProjectDatabaseImport> {
  if (!userId || !projectId) {
    throw new Error("Missing user or project")
  }

  const response = await fetch("/api/sync/import-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, projectId })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || `HTTP error! status: ${response.status}`)
  }

  return data as ProjectDatabaseImport
}

/**
 * Reconciles local chapters/notes with PostgreSQL via Next.js API for a specific project.
 */
export async function syncChaptersWithCloud(userId: string, projectId: string, localNotes: Note[]): Promise<Note[]> {
  if (!userId || !projectId) return localNotes

  try {
    const response = await fetchWithTimeout("/api/sync/chapters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, localNotes }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const merged = (data.chapters || []) as Note[]

    // Cache the reconciled chapters locally
    await saveManuscriptLocal(projectId, merged)
    return merged
  } catch (error) {
    console.error("Failed to sync chapters with cloud, falling back to local:", error)
    return localNotes
  }
}

/**
 * Saves a single project document to PostgreSQL via Next.js API.
 */
export async function saveProjectToCloud(userId: string, project: Project): Promise<void> {
  if (!userId || !project || !project.id) return

  try {
    const response = await fetch("/api/sync/save-project", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, project })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to save project to cloud:", error)
  }
}

/**
 * Saves a single chapter document to PostgreSQL via Next.js API.
 */
export async function saveChapterToCloud(userId: string, projectId: string, note: Note): Promise<void> {
  if (!userId || !projectId || !note || !note.id) return

  try {
    const response = await fetch("/api/sync/save-chapter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, note })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to save chapter to cloud:", error)
  }
}

/**
 * Deletes a project and its nested chapters from PostgreSQL via Next.js API.
 */
export async function deleteProjectFromCloud(userId: string, projectId: string): Promise<void> {
  if (!userId || !projectId) return

  try {
    const response = await fetch("/api/sync/delete-project", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to delete project from cloud:", error)
  }
}

/**
 * Deletes a single chapter document from PostgreSQL via Next.js API.
 */
export async function deleteChapterFromCloud(userId: string, projectId: string, chapterId: string): Promise<void> {
  if (!userId || !projectId || !chapterId) return

  try {
    const response = await fetch("/api/sync/delete-chapter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, chapterId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to delete chapter from cloud:", error)
  }
}

/**
 * Reconciles local Bible entries with PostgreSQL via Next.js API.
 */
export async function syncBibleWithCloud(userId: string, projectId: string, localEntries: BibleEntry[]): Promise<BibleEntry[]> {
  if (!userId || !projectId) return localEntries

  try {
    const response = await fetchWithTimeout("/api/sync/bible", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, localEntries }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const merged = (data.entries || []) as BibleEntry[]

    // Cache the reconciled bible entries locally
    await saveStoryBibleLocal(projectId, merged)
    return merged
  } catch (error) {
    console.error("Failed to sync bible with cloud, falling back to local:", error)
    return localEntries
  }
}

/**
 * Saves a single Bible entry to PostgreSQL via Next.js API.
 */
export async function saveBibleEntryToCloud(userId: string, projectId: string, entry: BibleEntry): Promise<void> {
  if (!userId || !projectId || !entry || !entry.id) return

  try {
    const response = await fetch("/api/sync/save-bible-entry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, entry })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to save bible entry to cloud:", error)
  }
}

/**
 * Deletes a single Bible entry from PostgreSQL via Next.js API.
 */
export async function deleteBibleEntryFromCloud(userId: string, projectId: string, entryId: string): Promise<void> {
  if (!userId || !projectId || !entryId) return

  try {
    const response = await fetch("/api/sync/delete-bible-entry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, entryId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to delete bible entry from cloud:", error)
  }
}

/**
 * Reconciles local Brain entries with PostgreSQL via Next.js API.
 */
export async function syncBrainWithCloud(userId: string, projectId: string, localEntries: BrainEntry[]): Promise<BrainEntry[]> {
  if (!userId || !projectId) return localEntries

  try {
    const response = await fetchWithTimeout("/api/sync/brain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, localEntries }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const merged = (data.entries || []) as BrainEntry[]

    await saveStoryBrainLocal(projectId, merged)
    return merged
  } catch (error) {
    console.error("Failed to sync brain with cloud, falling back to local:", error)
    return localEntries
  }
}

/**
 * Saves a single Brain entry to PostgreSQL via Next.js API.
 */
export async function saveBrainEntryToCloud(userId: string, projectId: string, entry: BrainEntry): Promise<void> {
  if (!userId || !projectId || !entry || !entry.id) return

  try {
    const response = await fetch("/api/sync/save-brain-entry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, entry })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to save brain entry to cloud:", error)
  }
}

/**
 * Deletes a single Brain entry from PostgreSQL via Next.js API.
 */
export async function deleteBrainEntryFromCloud(userId: string, projectId: string, entryId: string): Promise<void> {
  if (!userId || !projectId || !entryId) return

  try {
    const response = await fetch("/api/sync/delete-brain-entry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, entryId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to delete brain entry from cloud:", error)
  }
}

/**
 * Reconciles local Arc Seeds with PostgreSQL via Next.js API.
 */
export async function syncArcSeedsWithCloud(userId: string, projectId: string, localSeeds: ArcSeed[]): Promise<ArcSeed[]> {
  if (!userId || !projectId) return localSeeds

  try {
    const response = await fetchWithTimeout("/api/sync/arc-seeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, localSeeds }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return (data.seeds || []) as ArcSeed[]
  } catch (error) {
    console.error("Failed to sync arc seeds with cloud, falling back to local:", error)
    return localSeeds
  }
}

export async function saveArcSeedToCloud(userId: string, projectId: string, seed: ArcSeed): Promise<void> {
  if (!userId || !projectId || !seed || !seed.id) return

  try {
    const response = await fetch("/api/sync/save-arc-seed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, seed })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to save arc seed to cloud:", error)
  }
}

export async function deleteArcSeedFromCloud(userId: string, projectId: string, seedId: string): Promise<void> {
  if (!userId || !projectId || !seedId) return

  try {
    const response = await fetch("/api/sync/delete-arc-seed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, seedId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to delete arc seed from cloud:", error)
  }
}

/**
 * Reconciles local progression profiles with PostgreSQL via Next.js API.
 */
export async function syncProgressionProfilesWithCloud(userId: string, projectId: string, localProfiles: unknown[]): Promise<unknown[]> {
  if (!userId || !projectId) return localProfiles

  try {
    const response = await fetchWithTimeout("/api/sync/progression-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projectId, localProfiles }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return (data.profiles || []) as unknown[]
  } catch (error) {
    console.error("Failed to sync progression profiles with cloud, falling back to local:", error)
    return localProfiles
  }
}

/**
 * Saves a single progression profile to PostgreSQL via Next.js API.
 */
export async function saveProgressionProfileToCloud(userId: string, projectId: string, profile: unknown): Promise<void> {
  if (!userId || !projectId || !profile || !(profile as Record<string, unknown>).id) return

  try {
    const response = await fetch("/api/sync/save-progression-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projectId, profile })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to save progression profile to cloud:", error)
  }
}

/**
 * Deletes a single progression profile from PostgreSQL via Next.js API.
 */
export async function deleteProgressionProfileFromCloud(userId: string, projectId: string, profileId: string): Promise<void> {
  if (!userId || !projectId || !profileId) return

  try {
    const response = await fetch("/api/sync/delete-progression-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projectId, profileId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to delete progression profile from cloud:", error)
  }
}

/**
 * Reconciles local progression system settings with PostgreSQL via Next.js API.
 */
export async function syncProgressionSystemWithCloud(userId: string, projectId: string, localSystem: unknown): Promise<unknown> {
  if (!userId || !projectId) return localSystem

  try {
    const response = await fetchWithTimeout("/api/sync/progression-system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projectId, localSystem }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.system as unknown
  } catch (error) {
    console.error("Failed to sync progression system with cloud, falling back to local:", error)
    return localSystem
  }
}

/**
 * Saves progression system settings to PostgreSQL via Next.js API.
 */
export async function saveProgressionSystemToCloud(userId: string, projectId: string, system: unknown): Promise<void> {
  if (!userId || !projectId || !system) return

  try {
    const response = await fetch("/api/sync/save-progression-system", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, projectId, system })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to save progression system to cloud:", error)
  }
}

/**
 * Reconciles local reference library with PostgreSQL via Next.js API.
 */
export async function syncReferenceLibraryWithCloud(userId: string, projectId: string, localData: unknown[]): Promise<unknown[]> {
  if (!userId || !projectId) return localData

  try {
    const response = await fetchWithTimeout("/api/sync/reference-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projectId, localData }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const merged = (data.data || []) as unknown[]

    await saveReferenceLibraryLocal(projectId, merged)
    return merged
  } catch (error) {
    console.error("Failed to sync reference library with cloud, falling back to local:", error)
    return localData
  }
}

/**
 * Saves reference library data to PostgreSQL via Next.js API.
 */
export async function saveReferenceLibraryToCloud(userId: string, projectId: string, data: unknown[]): Promise<void> {
  if (!userId || !projectId) return

  try {
    const response = await fetch("/api/sync/save-reference-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projectId, data })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to save reference library to cloud:", error)
  }
}

/**
 * Reconciles local Name Forge data with PostgreSQL via Next.js API.
 */
export async function syncNameForgeWithCloud(userId: string, projectId: string, localData: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!userId || !projectId) return localData

  try {
    const response = await fetchWithTimeout("/api/sync/name-forge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projectId, localData }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    const merged = (result.data || {}) as Record<string, unknown>

    await saveNameForgeDataLocal(projectId, merged as unknown as Omit<NameForgeData, 'projectId' | 'updatedAt'>)
    return merged
  } catch (error) {
    console.error("Failed to sync name forge data with cloud, falling back to local:", error)
    return localData
  }
}

/**
 * Saves Name Forge data to PostgreSQL via Next.js API.
 */
export async function saveNameForgeDataToCloud(userId: string, projectId: string, data: Record<string, unknown>): Promise<void> {
  if (!userId || !projectId || !data) return

  try {
    const response = await fetch("/api/sync/save-name-forge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projectId, data })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to save name forge data to cloud:", error)
  }
}
