// Minimal PDF library: stores blobs in IndexedDB, metadata in localStorage.
export type LibraryEntry = {
  id: string;
  name: string;
  size: number;
  lastOpened: number;
  favorite: boolean;
};

const DB_NAME = "pdf-library";
const STORE = "files";
const LS_KEY = "pdf-library:entries";
const EVT = "pdf-library:changed";
const MAX_RECENTS = 20;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbGet(id: string): Promise<Blob | undefined> {
  const db = await openDB();
  try {
    return await new Promise<Blob | undefined>((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(id);
      r.onsuccess = () => res(r.result as Blob | undefined);
      r.onerror = () => rej(r.error);
    });
  } finally {
    db.close();
  }
}

async function idbDel(id: string): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
}

export function getEntries(): LibraryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: LibraryEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(EVT));
}

export function onLibraryChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function idForFile(name: string, size: number): string {
  return `${size}::${name}`;
}

export async function recordOpen(file: File): Promise<string> {
  const id = idForFile(file.name, file.size);
  try {
    await idbPut(id, file);
  } catch (e) {
    console.warn("[pdf-library] IndexedDB save failed", e);
  }
  const entries = getEntries();
  const existing = entries.find((e) => e.id === id);
  const now = Date.now();
  if (existing) {
    existing.lastOpened = now;
    existing.name = file.name;
    existing.size = file.size;
  } else {
    entries.push({ id, name: file.name, size: file.size, lastOpened: now, favorite: false });
  }
  // Cap non-favorite entries.
  const sorted = entries.sort((a, b) => b.lastOpened - a.lastOpened);
  const kept: LibraryEntry[] = [];
  let recentCount = 0;
  const toDrop: string[] = [];
  for (const e of sorted) {
    if (e.favorite) {
      kept.push(e);
    } else if (recentCount < MAX_RECENTS) {
      kept.push(e);
      recentCount++;
    } else {
      toDrop.push(e.id);
    }
  }
  saveEntries(kept);
  for (const dropId of toDrop) {
    idbDel(dropId).catch(() => {});
  }
  return id;
}

export async function loadFile(id: string): Promise<File | null> {
  const entry = getEntries().find((e) => e.id === id);
  if (!entry) return null;
  try {
    const blob = await idbGet(id);
    if (!blob) return null;
    return new File([blob], entry.name, { type: "application/pdf" });
  } catch (e) {
    console.warn("[pdf-library] load failed", e);
    return null;
  }
}

export function toggleFavorite(id: string): boolean {
  const entries = getEntries();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return false;
  entry.favorite = !entry.favorite;
  saveEntries(entries);
  return entry.favorite;
}

export function isFavorite(id: string): boolean {
  return !!getEntries().find((e) => e.id === id && e.favorite);
}

export async function removeEntry(id: string): Promise<void> {
  await idbDel(id).catch(() => {});
  saveEntries(getEntries().filter((e) => e.id !== id));
}
