/* eslint-disable @typescript-eslint/no-explicit-any */
import { openDB, IDBPDatabase } from 'idb';

export interface PenPadDB {
  'stylometry': {
    key: string;
    value: {
      id: string;
      avgSentenceLength: number;
      topNGrams: Record<string, number>;
      passiveRatio: number;
      lastUpdated: number;
    };
  };
  'learned_patterns': {
    key: string;
    value: {
      pattern: string;
      type: 'style' | 'grammar';
      suppress: boolean;
      frequencyCount: number;
    };
  };
  'directory_handles': {
    key: string;
    value: FileSystemDirectoryHandle;
  };
  'manuscripts': {
    key: string;
    value: {
      projectId: string;
      data: any[];
      updatedAt: number;
    };
  };
  'story_bible': {
    key: string;
    value: {
      projectId: string;
      data: any[];
      updatedAt: number;
    };
  };
  'story_brain': {
    key: string;
    value: {
      projectId: string;
      data: any[];
      updatedAt: number;
    };
  };
  'version_history': {
    key: string;
    value: {
      noteId: string;
      data: any[];
      updatedAt: number;
    };
  };
  'export_history': {
    key: string;
    value: {
      projectId: string;
      data: Record<string, any>;
      updatedAt: number;
    };
  };
}

const DB_NAME = 'penpad_engine_db';
const DB_VERSION = 4;

export async function getDB(): Promise<IDBPDatabase<any>> {
  return openDB<any>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('stylometry')) {
        db.createObjectStore('stylometry', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('learned_patterns')) {
        db.createObjectStore('learned_patterns', { keyPath: 'pattern' });
      }
      if (!db.objectStoreNames.contains('directory_handles')) {
        db.createObjectStore('directory_handles', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('manuscripts')) {
        db.createObjectStore('manuscripts', { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains('story_bible')) {
        db.createObjectStore('story_bible', { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains('story_brain')) {
        db.createObjectStore('story_brain', { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains('version_history')) {
        db.createObjectStore('version_history', { keyPath: 'noteId' });
      }
      if (!db.objectStoreNames.contains('export_history')) {
        db.createObjectStore('export_history', { keyPath: 'projectId' });
      }
    },
  });
}

export async function saveDirectoryHandleForProject(projectId: string, handle: FileSystemDirectoryHandle | null) {
  const db = await getDB();
  if (handle === null) {
    await db.delete('directory_handles', projectId);
  } else {
    await db.put('directory_handles', { key: projectId, ...handle });
  }
}

export async function getDirectoryHandleForProject(projectId: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await getDB();
  const result = await db.get('directory_handles', projectId);
  return result || null;
}

export async function restoreDirectoryHandleForProject(projectId: string): Promise<FileSystemDirectoryHandle | null> {
  const stored = await getDirectoryHandleForProject(projectId);
  if (!stored) return null;
  
  try {
    const permission = await stored.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') {
      return stored;
    }
    
    try {
      const requestPermission = await stored.requestPermission({ mode: 'readwrite' });
      if (requestPermission === 'granted') {
        return stored;
      }
    } catch {
      // Permission denied
    }
  } catch (e) {
    console.error("Error restoring directory handle:", e);
  }
  
  return null;
}

// IndexedDB Helper CRUD functions for Manuscripts, Bible, Brain, and Versions
export async function saveManuscriptLocal(projectId: string, data: any[]) {
  const db = await getDB();
  await db.put('manuscripts', { projectId, data, updatedAt: Date.now() });
}

export async function getManuscriptLocal(projectId: string): Promise<any[] | null> {
  const db = await getDB();
  const res = await db.get('manuscripts', projectId);
  return res ? res.data : null;
}

export async function saveStoryBibleLocal(projectId: string, data: any[]) {
  const db = await getDB();
  await db.put('story_bible', { projectId, data, updatedAt: Date.now() });
}

export async function getStoryBibleLocal(projectId: string): Promise<any[] | null> {
  const db = await getDB();
  const res = await db.get('story_bible', projectId);
  return res ? res.data : null;
}

export async function saveStoryBrainLocal(projectId: string, data: any[]) {
  const db = await getDB();
  await db.put('story_brain', { projectId, data, updatedAt: Date.now() });
}

export async function getStoryBrainLocal(projectId: string): Promise<any[] | null> {
  const db = await getDB();
  const res = await db.get('story_brain', projectId);
  return res ? res.data : null;
}

export async function saveChapterVersionsLocal(noteId: string, data: any[]) {
  const db = await getDB();
  await db.put('version_history', { noteId, data, updatedAt: Date.now() });
}

export async function getChapterVersionsLocal(noteId: string): Promise<any[] | null> {
  const db = await getDB();
  const res = await db.get('version_history', noteId);
  return res ? res.data : null;
}

export async function saveExportHistoryLocal(projectId: string, data: Record<string, any>) {
  const db = await getDB();
  await db.put('export_history', { projectId, data, updatedAt: Date.now() });
}

export async function getExportHistoryLocal(projectId: string): Promise<Record<string, any> | null> {
  const db = await getDB();
  const res = await db.get('export_history', projectId);
  return res ? res.data : null;
}
