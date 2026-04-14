import { getFirebaseDb } from './firebase'
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore'

export interface CloudProject {
  id: string
  name: string
  ownerId: string
  lastUpdated: number
}

export interface CloudNote {
  id: string
  projectId: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  isMemories?: boolean
}

export async function syncProjectToCloud(project: CloudProject): Promise<void> {
  const db = getFirebaseDb()
  if (!db) return
  
  await setDoc(doc(db, 'projects', project.id), project)
}

export async function fetchProjectsFromCloud(ownerId: string): Promise<CloudProject[]> {
  const db = getFirebaseDb()
  if (!db) return []
  
  try {
    const q = query(
      collection(db, 'projects'),
      orderBy('lastUpdated', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs
      .map(doc => doc.data() as CloudProject)
      .filter(p => p.ownerId === ownerId)
  } catch (e) {
    console.error('Failed to fetch cloud projects:', e)
    return []
  }
}

export async function deleteProjectFromCloud(projectId: string): Promise<void> {
  const db = getFirebaseDb()
  if (!db) return
  
  await deleteDoc(doc(db, 'projects', projectId))
  const notesQuery = query(collection(db, 'notes'))
  const notesSnapshot = await getDocs(notesQuery)
  const batch = notesSnapshot.docs.filter(n => n.data().projectId === projectId)
  await Promise.all(batch.map(n => deleteDoc(doc(db, 'notes', n.id))))
}

export async function syncNoteToCloud(note: CloudNote): Promise<void> {
  const db = getFirebaseDb()
  if (!db) return
  
  await setDoc(doc(db, 'notes', note.id), note)
}

export async function fetchNotesFromCloud(projectId: string): Promise<CloudNote[]> {
  const db = getFirebaseDb()
  if (!db) return []
  
  try {
    const q = query(
      collection(db, 'notes'),
      orderBy('updatedAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs
      .map(doc => doc.data() as CloudNote)
      .filter(n => n.projectId === projectId)
  } catch (e) {
    console.error('Failed to fetch cloud notes:', e)
    return []
  }
}

export async function deleteNoteFromCloud(noteId: string): Promise<void> {
  const db = getFirebaseDb()
  if (!db) return
  
  await deleteDoc(doc(db, 'notes', noteId))
}