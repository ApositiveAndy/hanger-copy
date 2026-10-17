import type { Citation, ListingDraft, PlatformId } from "@/lib/listing";

export type ListingStatus = "ready" | "listed" | "sold";

export type SavedListing = {
  id: string;
  createdAt: number;
  updatedAt: number;
  imageDataUrl: string;
  status: ListingStatus;
  platform?: PlatformId;
  askPrice: number;
  soldPrice?: number;
  draft: ListingDraft;
  citations: Citation[];
};

const DB_NAME = "hanger";
const STORE = "listings";

const listeners = new Set<() => void>();

export function subscribeCloset(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const listener of listeners) listener();
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Saving listings isn’t available in this browser."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Couldn’t open your closet."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Couldn’t update your closet."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Couldn’t update your closet."));
      tx.onabort = () => reject(tx.error ?? new Error("Couldn’t update your closet."));
    });
    try {
      const result = await run(tx.objectStore(STORE));
      await done;
      return result;
    } catch (error) {
      await done.catch(() => undefined);
      throw error;
    }
  } finally {
    db.close();
  }
}

export async function listListings(): Promise<SavedListing[]> {
  const rows = await withStore("readonly", (store) => requestToPromise(store.getAll()));
  return (rows as SavedListing[]).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getListing(id: string): Promise<SavedListing | null> {
  const row = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  return (row as SavedListing | undefined) ?? null;
}

export async function saveListing(listing: SavedListing): Promise<void> {
  const next = { ...listing, updatedAt: Date.now() };
  try {
    await withStore("readwrite", async (store) => {
      await requestToPromise(store.put(next));
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "QuotaExceededError") {
      throw new Error("This device is out of room for more photos. Remove an old listing first.");
    }
    throw error instanceof Error ? error : new Error("Couldn’t save this listing.");
  }
  emit();
}

export async function deleteListing(id: string): Promise<void> {
  await withStore("readwrite", async (store) => {
    await requestToPromise(store.delete(id));
  });
  emit();
}
