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
}

const DB_NAME = 'penpad_engine_db';
const DB_VERSION = 1;

export async function getDB(): Promise<IDBPDatabase<PenPadDB>> {
  return openDB<PenPadDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('stylometry')) {
        db.createObjectStore('stylometry', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('learned_patterns')) {
        db.createObjectStore('learned_patterns', { keyPath: 'pattern' });
      }
    },
  });
}

export async function saveProfile(profile: PenPadDB['stylometry']['value']) {
  const db = await getDB();
  await db.put('stylometry', profile);
}

export async function getProfile(id: string) {
  const db = await getDB();
  return db.get('stylometry', id);
}

export async function learnPattern(pattern: string, type: 'style' | 'grammar') {
  const db = await getDB();
  const existing = await db.get('learned_patterns', pattern);
  const count = (existing?.frequencyCount || 0) + 1;
  
  await db.put('learned_patterns', {
    pattern,
    type,
    suppress: count >= 3, // Auto-suppress after 3 ignores/hits
    frequencyCount: count
  });
}

export async function getSuppressedPatterns() {
  const db = await getDB();
  const all = await db.getAll('learned_patterns');
  return all.filter(p => p.suppress).map(p => p.pattern);
}
