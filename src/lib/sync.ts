export interface Project {
  id: string
  name: string
  lastUpdated?: number
}

export interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  isMemories?: boolean
  wordGoal?: number
}

export interface BibleEntry {
  id: string
  name: string
  category: "character" | "world" | "beast" | "place" | "item"
  content: string
  createdAt: number
  updatedAt: number
}

export interface BrainEntry {
  id: string
  highlightedText: string
  aiSummary: string
  chapterTitle: string
  chapterId: string
  chapterNumber?: number
  createdAt: number
  updatedAt: number
}

/**
 * Helper to execute a fetch request with a timeout.
 */
async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 3500, ...fetchOptions } = options
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
      body: JSON.stringify({ userId, localProjects }),
      timeout: 3500
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
      timeout: 3500
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const merged = (data.chapters || []) as Note[]

    // Cache the reconciled chapters locally
    localStorage.setItem(`penpad_notes_${projectId}`, JSON.stringify(merged))
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
      timeout: 3500
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const merged = (data.entries || []) as BibleEntry[]

    // Cache the reconciled bible entries locally
    localStorage.setItem(`penpad_bible_${projectId}`, JSON.stringify(merged))
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
      timeout: 3500
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const merged = (data.entries || []) as BrainEntry[]

    localStorage.setItem(`penpad_brain_${projectId}`, JSON.stringify(merged))
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
