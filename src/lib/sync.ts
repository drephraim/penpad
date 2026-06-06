import { getFirebaseDb } from "./firebase"
import { collection, doc, getDocs, setDoc, deleteDoc } from "firebase/firestore"

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

/**
 * Reconciles local projects with Firestore.
 * - If only local: uploads to Firestore.
 * - If only in cloud: downloads to local.
 * - If in both: compares lastUpdated timestamp, uploads/downloads the newer version.
 */
export async function syncProjectsWithCloud(userId: string, localProjects: Project[]): Promise<Project[]> {
  const db = getFirebaseDb()
  if (!db) return localProjects

  try {
    const projectsCol = collection(db, "users", userId, "projects")
    const snapshot = await getDocs(projectsCol)
    
    const cloudProjects: Project[] = []
    snapshot.forEach(docSnap => {
      const data = docSnap.data()
      cloudProjects.push({
        id: docSnap.id,
        name: data.name || "Untitled",
        lastUpdated: data.lastUpdated || 0
      })
    })

    const cloudProjectsMap = new Map(cloudProjects.map(p => [p.id, p]))
    const localProjectsMap = new Map(localProjects.map(p => [p.id, p]))
    const finalProjectsMap = new Map<string, Project>()

    // Reconcile local storage projects
    for (const localProj of localProjects) {
      const cloudProj = cloudProjectsMap.get(localProj.id)
      if (!cloudProj) {
        // Upload local project to cloud
        await setDoc(doc(db, "users", userId, "projects", localProj.id), {
          name: localProj.name,
          lastUpdated: localProj.lastUpdated || Date.now()
        })
        finalProjectsMap.set(localProj.id, localProj)
      } else {
        const localTime = localProj.lastUpdated || 0
        const cloudTime = cloudProj.lastUpdated || 0
        if (localTime > cloudTime) {
          // Local is newer, upload to cloud
          await setDoc(doc(db, "users", userId, "projects", localProj.id), {
            name: localProj.name,
            lastUpdated: localProj.lastUpdated
          })
          finalProjectsMap.set(localProj.id, localProj)
        } else {
          // Cloud is newer, use cloud version
          finalProjectsMap.set(localProj.id, cloudProj)
        }
      }
    }

    // Pull down cloud projects that aren't in local storage
    for (const cloudProj of cloudProjects) {
      if (!localProjectsMap.has(cloudProj.id)) {
        finalProjectsMap.set(cloudProj.id, cloudProj)
      }
    }

    const merged = Array.from(finalProjectsMap.values()).sort((a, b) => {
      const timeA = typeof a.lastUpdated === 'number' ? a.lastUpdated : 0
      const timeB = typeof b.lastUpdated === 'number' ? b.lastUpdated : 0
      return timeB - timeA
    })

    // Cache the reconciled projects locally
    localStorage.setItem(`penpad_projects_${userId}`, JSON.stringify(merged))
    return merged
  } catch (error) {
    console.error("Failed to sync projects with cloud:", error)
    return localProjects
  }
}

/**
 * Reconciles local chapters with Firestore for a specific project.
 */
export async function syncChaptersWithCloud(userId: string, projectId: string, localNotes: Note[]): Promise<Note[]> {
  const db = getFirebaseDb()
  if (!db) return localNotes

  try {
    const chaptersCol = collection(db, "users", userId, "projects", projectId, "chapters")
    const snapshot = await getDocs(chaptersCol)

    const cloudNotes: Note[] = []
    snapshot.forEach(docSnap => {
      const data = docSnap.data()
      cloudNotes.push({
        id: docSnap.id,
        title: data.title || "Untitled",
        content: data.content || "",
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now(),
        wordGoal: data.wordGoal
      })
    })

    const cloudNotesMap = new Map(cloudNotes.map(n => [n.id, n]))
    const localNotesMap = new Map(localNotes.map(n => [n.id, n]))
    const finalNotesMap = new Map<string, Note>()

    // Reconcile local storage chapters
    for (const localNote of localNotes) {
      const cloudNote = cloudNotesMap.get(localNote.id)
      if (!cloudNote) {
        // Upload to cloud
        await setDoc(doc(db, "users", userId, "projects", projectId, "chapters", localNote.id), {
          title: localNote.title,
          content: localNote.content,
          createdAt: localNote.createdAt,
          updatedAt: localNote.updatedAt || Date.now(),
          wordGoal: localNote.wordGoal || 1200
        })
        finalNotesMap.set(localNote.id, localNote)
      } else {
        const localTime = localNote.updatedAt || 0
        const cloudTime = cloudNote.updatedAt || 0
        if (localTime > cloudTime) {
          // Local is newer, upload to cloud
          await setDoc(doc(db, "users", userId, "projects", projectId, "chapters", localNote.id), {
            title: localNote.title,
            content: localNote.content,
            createdAt: localNote.createdAt,
            updatedAt: localNote.updatedAt,
            wordGoal: localNote.wordGoal || 1200
          })
          finalNotesMap.set(localNote.id, localNote)
        } else {
          // Cloud is newer, use cloud version
          finalNotesMap.set(localNote.id, cloudNote)
        }
      }
    }

    // Pull down cloud chapters that aren't in local storage
    for (const cloudNote of cloudNotes) {
      if (!localNotesMap.has(cloudNote.id)) {
        finalNotesMap.set(cloudNote.id, cloudNote)
      }
    }

    const merged = Array.from(finalNotesMap.values()).sort((a, b) => b.updatedAt - a.updatedAt)

    // Cache the reconciled chapters locally
    localStorage.setItem(`penpad_notes_${projectId}`, JSON.stringify(merged))
    return merged
  } catch (error) {
    console.error("Failed to sync chapters with cloud:", error)
    return localNotes
  }
}

/**
 * Saves a single project document to Firestore.
 */
export async function saveProjectToCloud(userId: string, project: Project): Promise<void> {
  const db = getFirebaseDb()
  if (!db) return

  try {
    await setDoc(doc(db, "users", userId, "projects", project.id), {
      name: project.name,
      lastUpdated: project.lastUpdated || Date.now()
    })
  } catch (error) {
    console.error("Failed to save project to cloud:", error)
  }
}

/**
 * Saves a single chapter document to Firestore.
 */
export async function saveChapterToCloud(userId: string, projectId: string, note: Note): Promise<void> {
  const db = getFirebaseDb()
  if (!db) return

  try {
    await setDoc(doc(db, "users", userId, "projects", projectId, "chapters", note.id), {
      title: note.title,
      content: note.content || "",
      createdAt: note.createdAt,
      updatedAt: note.updatedAt || Date.now(),
      wordGoal: note.wordGoal || 1200
    })
  } catch (error) {
    console.error("Failed to save chapter to cloud:", error)
  }
}

/**
 * Deletes a project document and its subcollections from Firestore.
 */
export async function deleteProjectFromCloud(userId: string, projectId: string): Promise<void> {
  const db = getFirebaseDb()
  if (!db) return

  try {
    await deleteDoc(doc(db, "users", userId, "projects", projectId))
    
    // Clean up all nested chapters
    const chaptersCol = collection(db, "users", userId, "projects", projectId, "chapters")
    const snapshot = await getDocs(chaptersCol)
    for (const docSnap of snapshot.docs) {
      await deleteDoc(docSnap.ref)
    }
  } catch (error) {
    console.error("Failed to delete project from cloud:", error)
  }
}

/**
 * Deletes a chapter document from Firestore.
 */
export async function deleteChapterFromCloud(userId: string, projectId: string, chapterId: string): Promise<void> {
  const db = getFirebaseDb()
  if (!db) return

  try {
    await deleteDoc(doc(db, "users", userId, "projects", projectId, "chapters", chapterId))
  } catch (error) {
    console.error("Failed to delete chapter from cloud:", error)
  }
}
