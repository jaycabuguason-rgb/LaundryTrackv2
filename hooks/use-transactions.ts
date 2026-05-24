"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Transaction } from "@/lib/data";
import {
  enqueueOfflineMutation,
  readCachedTransactions,
  readOfflineQueue,
  writeCachedTransactions,
  writeOfflineQueue,
  type OfflineMutationQueueItem,
} from "@/lib/offline-transactions";
import { isOnline, subscribeNetworkStatus } from "@/lib/network-status";
import { getBrowserAccessToken } from "@/lib/supabase/browser-session";
import { refreshBrowserSession } from "@/lib/supabase/browser-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CreateTransactionInput, UpdateTransactionInput, StampAwardResult } from "@/lib/transaction-contracts";

interface TransactionsResponse {
  transactions: Transaction[];
}

interface TransactionResponse {
  transaction: Transaction;
  loyaltyResult?: StampAwardResult;
}

interface ResolveResponse {
  ticketId: string | null;
}

async function readJson<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let data: unknown = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText) as unknown;
    } catch {
      data = {};
    }
  }
  if (!response.ok) {
    const fallbackText = rawText.trim();
    const message =
      typeof data === "object" && data && "error" in data && typeof data.error === "string"
        ? data.error
        : fallbackText
          ? `Request failed (${response.status}): ${fallbackText.slice(0, 300)}`
          : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return data as T;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  let accessToken = await getBrowserAccessToken();
  if (!accessToken) {
    const refreshed = await refreshBrowserSession();
    accessToken = refreshed?.access_token ?? null;
  }
  if (!accessToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"online" | "offline" | "syncing" | "error">(
    isOnline() ? "online" : "offline",
  );
  const [pendingChangesCount, setPendingChangesCount] = useState<number>(0);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const queueSyncInFlightRef = useRef(false);
  const hydratedRef = useRef(false);

  const persistTransactions = useCallback(async (next: Transaction[]) => {
    setTransactions(next);
    await writeCachedTransactions(next);
  }, []);

  const updateTransactions = useCallback((updater: (current: Transaction[]) => Transaction[]) => {
    setTransactions((current) => {
      const next = updater(current);
      void writeCachedTransactions(next);
      return next;
    });
  }, []);

  const hydrateOfflineState = useCallback(async () => {
    const [cached, queue] = await Promise.all([readCachedTransactions(), readOfflineQueue()]);
    if (cached.length > 0) {
      setTransactions(cached);
      setError(null);
    }
    setPendingChangesCount(queue.length);
    hydratedRef.current = true;
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!hydratedRef.current) {
      await hydrateOfflineState();
    }

    if (!isOnline()) {
      const cached = await readCachedTransactions();
      const queue = await readOfflineQueue();
      if (cached.length > 0) {
        setTransactions(cached);
        setError(null);
      }
      setPendingChangesCount(queue.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const queue = await readOfflineQueue();
      const headers = await getAuthHeaders();
      const response = await fetch("/api/transactions", {
        cache: "no-store",
        headers,
      });
      const data = await readJson<TransactionsResponse>(response);
      if (queue.length === 0) {
        await persistTransactions(data.transactions);
      } else {
        // Keep local optimistic view until queued items are acknowledged.
        const localData = await readCachedTransactions();
        if (localData.length > 0) {
          setTransactions(localData);
        }
      }
      setError(null);
      setLastSyncError(null);
      setSyncStatus("online");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to load transactions.";
      setError(message);
      setLastSyncError(message);
      setSyncStatus(isOnline() ? "error" : "offline");
    } finally {
      setLoading(false);
    }
  }, [hydrateOfflineState, persistTransactions]);

  useEffect(() => {
    void (async () => {
      await hydrateOfflineState();
      await refresh();
    })();
  }, [hydrateOfflineState, refresh]);

  const processQueue = useCallback(async () => {
    if (queueSyncInFlightRef.current) {
      return;
    }

    if (!isOnline()) {
      setSyncStatus("offline");
      return;
    }

    const queue = await readOfflineQueue();
    if (queue.length === 0) {
      setPendingChangesCount(0);
      setSyncStatus("online");
      return;
    }

    queueSyncInFlightRef.current = true;
    try {
      setSyncStatus("syncing");
      const remaining: OfflineMutationQueueItem[] = [];

      for (const item of queue) {
        try {
          const headers = await getAuthHeaders();
          if (!headers.Authorization) {
            throw new Error("Your session expired. Please sign in again, then tap Retry Sync.");
          }

          if (item.type === "create" && item.createInput) {
            const response = await fetch("/api/transactions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...headers,
              },
              body: JSON.stringify(item.createInput),
            });

            await readJson<TransactionResponse>(response);
          } else if (item.type === "update" && item.ticketId && item.updateInput) {
            const response = await fetch(`/api/transactions/${encodeURIComponent(item.ticketId)}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                ...headers,
              },
              body: JSON.stringify(item.updateInput),
            });

            await readJson<TransactionResponse>(response);
          }
        } catch (syncError) {
          remaining.push({
            ...item,
            retryCount: item.retryCount + 1,
            lastError: syncError instanceof Error ? syncError.message : "Failed to sync offline changes.",
          });
          setLastSyncError(syncError instanceof Error ? syncError.message : "Failed to sync offline changes.");
        }
      }

      await writeOfflineQueue(remaining);
      setPendingChangesCount(remaining.length);

      if (remaining.length > 0) {
        setSyncStatus("error");
      } else {
        setSyncStatus("online");
        setLastSyncError(null);
        await refresh();
      }
    } finally {
      queueSyncInFlightRef.current = false;
    }
  }, [refresh]);

  useEffect(() => subscribeNetworkStatus((online) => {
    setSyncStatus(online ? "online" : "offline");
    if (online) {
      void processQueue();
      void refresh();
    }
  }), [processQueue, refresh]);

  useEffect(() => {
    if (!isOnline()) {
      return;
    }

    void (async () => {
      if ((await readOfflineQueue()).length > 0) {
        await processQueue();
      }
    })();
  }, [processQueue]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return undefined;
    }

    const channel = supabase
      .channel("laundrytrack-transactions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const createTransaction = useCallback(async (input: CreateTransactionInput) => {
    if (!isOnline()) {
      const localId = `offline-${Date.now()}`;
      const optimistic: Transaction = {
        id: localId,
        ticketId: `OFF-${Date.now().toString().slice(-6)}`,
        customerName: input.customerName,
        phone: input.phone,
        arrivalDateTime: input.arrivalDateTime,
        dropOffDate: input.dropOffDate ?? input.arrivalDateTime.split(" ")[0],
        washType: input.washType,
        weight: input.weight,
        fee: input.fee,
        status: input.status,
        paymentStatus: input.paymentStatus,
        addOns: input.addOns,
        washInstructions: input.washInstructions,
        eta: input.eta ?? null,
      };
      await enqueueOfflineMutation({ type: "create", createInput: input, localId });
      setPendingChangesCount((await readOfflineQueue()).length);
      setSyncStatus("offline");
      updateTransactions((current) => [optimistic, ...current]);
      return optimistic;
    }

    const headers = await getAuthHeaders();
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(input),
    });

    const data = await readJson<TransactionResponse>(response);
    updateTransactions((current) => [data.transaction, ...current]);
    return data.transaction;
  }, [updateTransactions]);

  const updateTransaction = useCallback(async (ticketId: string, updates: UpdateTransactionInput) => {
    if (!isOnline()) {
      await enqueueOfflineMutation({ type: "update", ticketId, updateInput: updates });
      setPendingChangesCount((await readOfflineQueue()).length);
      setSyncStatus("offline");
      updateTransactions((current) =>
        current.map((transaction) =>
          transaction.ticketId === ticketId ? { ...transaction, ...updates } : transaction,
        ),
      );
      const updated = transactions.find((transaction) => transaction.ticketId === ticketId);
      return { transaction: { ...(updated ?? {}), ...updates } as Transaction };
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/transactions/${encodeURIComponent(ticketId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(updates),
    });

    const data = await readJson<TransactionResponse>(response);
    updateTransactions((current) =>
      current.map((transaction) =>
        transaction.ticketId === data.transaction.ticketId ? data.transaction : transaction,
      ),
    );
    return { transaction: data.transaction, loyaltyResult: data.loyaltyResult };
  }, [transactions, updateTransactions]);

  const resolveScannedValue = useCallback(async (value: string) => {
    const response = await fetch("/api/qr/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    });

    const data = await readJson<ResolveResponse>(response);
    return data.ticketId;
  }, []);

  return {
    transactions,
    loading,
    error,
    syncStatus,
    pendingChangesCount,
    lastSyncError,
    retrySync: processQueue,
    refresh,
    createTransaction,
    updateTransaction,
    resolveScannedValue,
  };
}
