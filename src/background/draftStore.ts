// ─── Draft Store (local safety-net snapshots) ────────────────
import { getDB } from './threadStore';
import type { Draft } from '../shared/types';

const DRAFTS_STORE = 'drafts';
const MAX_DRAFTS = 10;

export async function saveDraft(draft: Draft): Promise<void> {
  const db = await getDB();
  await db.put(DRAFTS_STORE, draft);
  
  // Enforce rolling cap — keep only the most recent MAX_DRAFTS
  const tx = db.transaction(DRAFTS_STORE, 'readwrite');
  const store = tx.objectStore(DRAFTS_STORE);
  const index = store.index('lastSnapshotAt');
  const allDrafts: Draft[] = [];
  
  let cursor = await index.openCursor(null, 'prev');
  while (cursor) {
    allDrafts.push(cursor.value as Draft);
    cursor = await cursor.continue();
  }
  
  if (allDrafts.length > MAX_DRAFTS) {
    const toDelete = allDrafts.slice(MAX_DRAFTS);
    for (const d of toDelete) {
      await store.delete(d.tabId);
    }
  }
  
  await tx.done;
}

export async function getDraft(tabId: number): Promise<Draft | undefined> {
  const db = await getDB();
  return db.get(DRAFTS_STORE, tabId);
}

export async function getAllDrafts(): Promise<Draft[]> {
  const db = await getDB();
  const tx = db.transaction(DRAFTS_STORE, 'readonly');
  const index = tx.objectStore(DRAFTS_STORE).index('lastSnapshotAt');
  const drafts: Draft[] = [];
  
  let cursor = await index.openCursor(null, 'prev');
  while (cursor) {
    drafts.push(cursor.value as Draft);
    cursor = await cursor.continue();
  }
  
  return drafts;
}

export async function deleteDraft(tabId: number): Promise<void> {
  const db = await getDB();
  await db.delete(DRAFTS_STORE, tabId);
}

export async function clearAllDrafts(): Promise<void> {
  const db = await getDB();
  await db.clear(DRAFTS_STORE);
}
