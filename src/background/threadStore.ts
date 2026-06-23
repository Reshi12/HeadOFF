// ─── IndexedDB Thread Store ──────────────────────────────────
import { openDB, type IDBPDatabase } from 'idb';
import type { Thread } from '../shared/types';

const DB_NAME = 'handoff-db';
const DB_VERSION = 1;
const THREADS_STORE = 'threads';
const DRAFTS_STORE = 'drafts';

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Threads store
        if (!db.objectStoreNames.contains(THREADS_STORE)) {
          const threadStore = db.createObjectStore(THREADS_STORE, { keyPath: 'id' });
          threadStore.createIndex('createdAt', 'createdAt');
          threadStore.createIndex('sourceSite', 'sourceSite');
          threadStore.createIndex('structuringStatus', 'structuringStatus');
        }
        // Drafts store
        if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
          const draftStore = db.createObjectStore(DRAFTS_STORE, { keyPath: 'tabId' });
          draftStore.createIndex('siteId', 'siteId');
          draftStore.createIndex('lastSnapshotAt', 'lastSnapshotAt');
        }
      },
    });
  }
  return dbPromise;
}

// ─── Thread CRUD ─────────────────────────────────────────────

export async function saveThread(thread: Thread): Promise<void> {
  const db = await getDB();
  await db.put(THREADS_STORE, thread);
}

export async function getThread(id: string): Promise<Thread | undefined> {
  const db = await getDB();
  return db.get(THREADS_STORE, id);
}

export async function getAllThreads(limit?: number, offset?: number): Promise<Thread[]> {
  const db = await getDB();
  const tx = db.transaction(THREADS_STORE, 'readonly');
  const store = tx.objectStore(THREADS_STORE);
  const index = store.index('createdAt');
  
  const threads: Thread[] = [];
  let cursor = await index.openCursor(null, 'prev'); // newest first
  let skipped = 0;
  
  while (cursor) {
    if (offset && skipped < offset) {
      skipped++;
      cursor = await cursor.continue();
      continue;
    }
    threads.push(cursor.value as Thread);
    if (limit && threads.length >= limit) break;
    cursor = await cursor.continue();
  }
  
  return threads;
}

export async function deleteThread(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(THREADS_STORE, id);
}

export async function updateThread(partial: Partial<Thread> & { id: string }): Promise<Thread | undefined> {
  const db = await getDB();
  const existing = await db.get(THREADS_STORE, partial.id);
  if (!existing) return undefined;
  
  const updated = { ...existing, ...partial } as Thread;
  await db.put(THREADS_STORE, updated);
  return updated;
}

export async function searchThreads(
  query: string,
  siteFilter?: string,
  tagFilter?: string
): Promise<Thread[]> {
  const all = await getAllThreads();
  const q = query.toLowerCase();
  
  return all.filter(thread => {
    // Site filter
    if (siteFilter && thread.sourceSite !== siteFilter) return false;
    
    // Tag filter
    if (tagFilter && !thread.tags.some(t => t.toLowerCase() === tagFilter.toLowerCase())) return false;
    
    // Text search
    if (q) {
      const searchable = [
        thread.title,
        thread.summary,
        thread.rawTranscript,
        ...thread.tags,
        ...thread.goals,
        ...thread.constraints,
        ...thread.keyDecisions,
      ].join(' ').toLowerCase();
      
      return searchable.includes(q);
    }
    
    return true;
  });
}

export async function getThreadCount(): Promise<number> {
  const db = await getDB();
  return db.count(THREADS_STORE);
}

export async function clearAllThreads(): Promise<void> {
  const db = await getDB();
  await db.clear(THREADS_STORE);
}

export async function exportAllThreads(): Promise<Thread[]> {
  return getAllThreads();
}

export async function importThreads(threads: Thread[]): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(THREADS_STORE, 'readwrite');
  let count = 0;
  
  for (const thread of threads) {
    await tx.store.put(thread);
    count++;
  }
  
  await tx.done;
  return count;
}

// ─── Storage usage estimation ────────────────────────────────
export async function getStorageUsage(): Promise<{ used: number; quota: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { used: 0, quota: 0 };
}
