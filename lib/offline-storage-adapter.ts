/**
 * Reusable offline storage adapter for any module
 * Provides IndexedDB with localStorage fallback
 */

const DB_NAME = "laundrytrack-offline-db";
const DB_VERSION = 1;
const STORE_NAME = "kv";

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Generic offline storage interface
 */
export interface OfflineStorageAdapter<T> {
  read: () => Promise<T>;
  write: (data: T) => Promise<void>;
}

/**
 * Create an offline storage adapter for any data type
 * Uses IndexedDB when available, falls back to localStorage
 */
export function createOfflineStorage<T>(
  key: string,
  defaultValue: T
): OfflineStorageAdapter<T> {
  if (hasIndexedDb()) {
    // IndexedDB adapter
    return {
      async read() {
        const raw = await idbGet<string>(key).catch(() => null);
        return parseJson<T>(raw ?? null, defaultValue);
      },
      async write(data) {
        await idbSet(key, JSON.stringify(data));
      },
    };
  }

  // localStorage fallback
  return {
    async read() {
      if (typeof window === "undefined") return defaultValue;
      return parseJson<T>(window.localStorage.getItem(key), defaultValue);
    },
    async write(data) {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, JSON.stringify(data));
    },
  };
}

/**
 * Queue item for offline mutations
 */
export interface OfflineQueueItem {
  id: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  createdAt: string;
  retryCount: number;
  lastError?: string | null;
}

/**
 * Create a mutation queue for offline operations
 */
export function createOfflineQueue(queueKey: string) {
  const storage = createOfflineStorage<OfflineQueueItem[]>(queueKey, []);

  return {
    async enqueue(
      mutation: Omit<OfflineQueueItem, "id" | "createdAt" | "retryCount">
    ): Promise<OfflineQueueItem> {
      const item: OfflineQueueItem = {
        ...mutation,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        lastError: null,
      };
      const queue = await storage.read();
      queue.push(item);
      await storage.write(queue);
      return item;
    },

    async getAll(): Promise<OfflineQueueItem[]> {
      return storage.read();
    },

    async process(
      handler: (item: OfflineQueueItem) => Promise<void>
    ): Promise<{ processed: number; failed: number }> {
      const queue = await storage.read();
      const remaining: OfflineQueueItem[] = [];
      let processed = 0;
      let failed = 0;

      for (const item of queue) {
        try {
          await handler(item);
          processed++;
        } catch (error) {
          failed++;
          remaining.push({
            ...item,
            retryCount: item.retryCount + 1,
            lastError:
              error instanceof Error
                ? error.message
                : "Failed to process queue item",
          });
        }
      }

      await storage.write(remaining);
      return { processed, failed };
    },

    async clear(): Promise<void> {
      await storage.write([]);
    },

    async count(): Promise<number> {
      const queue = await storage.read();
      return queue.length;
    },
  };
}
