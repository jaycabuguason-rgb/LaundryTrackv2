"use client";

import type { Transaction } from "@/lib/data";
import type { CreateTransactionInput, UpdateTransactionInput } from "@/lib/transaction-contracts";

const CACHE_KEY = "laundrytrack_cached_transactions_v1";
const QUEUE_KEY = "laundrytrack_txn_queue_v1";
const DB_NAME = "laundrytrack-offline-db";
const DB_VERSION = 1;
const STORE_NAME = "kv";

export type OfflineMutationType = "create" | "update";

export interface OfflineMutationQueueItem {
  id: string;
  type: OfflineMutationType;
  localId?: string;
  ticketId?: string;
  createInput?: CreateTransactionInput;
  updateInput?: UpdateTransactionInput;
  createdAt: string;
  retryCount: number;
  lastError?: string | null;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }
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

export interface OfflineTransactionsStorage {
  readTransactions: () => Promise<Transaction[]>;
  writeTransactions: (transactions: Transaction[]) => Promise<void>;
  readQueue: () => Promise<OfflineMutationQueueItem[]>;
  writeQueue: (items: OfflineMutationQueueItem[]) => Promise<void>;
}

const localStorageAdapter: OfflineTransactionsStorage = {
  async readTransactions() {
    if (typeof window === "undefined") return [];
    return parseJson<Transaction[]>(window.localStorage.getItem(CACHE_KEY), []);
  },
  async writeTransactions(transactions) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(transactions));
  },
  async readQueue() {
    if (typeof window === "undefined") return [];
    return parseJson<OfflineMutationQueueItem[]>(window.localStorage.getItem(QUEUE_KEY), []);
  },
  async writeQueue(items) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  },
};

const indexedDbAdapter: OfflineTransactionsStorage = {
  async readTransactions() {
    const raw = await idbGet<string>(CACHE_KEY).catch(() => null);
    return parseJson<Transaction[]>(raw ?? null, []);
  },
  async writeTransactions(transactions) {
    await idbSet(CACHE_KEY, JSON.stringify(transactions));
  },
  async readQueue() {
    const raw = await idbGet<string>(QUEUE_KEY).catch(() => null);
    return parseJson<OfflineMutationQueueItem[]>(raw ?? null, []);
  },
  async writeQueue(items) {
    await idbSet(QUEUE_KEY, JSON.stringify(items));
  },
};

export function getOfflineStorage(): OfflineTransactionsStorage {
  if (hasIndexedDb()) {
    return indexedDbAdapter;
  }
  return localStorageAdapter;
}

export async function readCachedTransactions(): Promise<Transaction[]> {
  return getOfflineStorage().readTransactions();
}

export async function writeCachedTransactions(transactions: Transaction[]): Promise<void> {
  await getOfflineStorage().writeTransactions(transactions);
}

export async function readOfflineQueue(): Promise<OfflineMutationQueueItem[]> {
  return getOfflineStorage().readQueue();
}

export async function writeOfflineQueue(items: OfflineMutationQueueItem[]): Promise<void> {
  await getOfflineStorage().writeQueue(items);
}

export async function enqueueOfflineMutation(
  mutation: Omit<OfflineMutationQueueItem, "id" | "createdAt" | "retryCount">,
): Promise<OfflineMutationQueueItem> {
  const next: OfflineMutationQueueItem = {
    ...mutation,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastError: null,
  };
  const storage = getOfflineStorage();
  const current = await storage.readQueue();
  current.push(next);
  await storage.writeQueue(current);
  return next;
}
