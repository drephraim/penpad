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
}

const DB_NAME = 'penpad_engine_db';
const DB_VERSION = 2;

export async function getDB(): Promise<IDBPDatabase<PenPadDB>> {
  return openDB<PenPadDB>(DB_NAME, DB_VERSION, {
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
