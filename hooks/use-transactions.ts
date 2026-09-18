"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { formatCompactDate, formatCompactDateTime } from "@/lib/date-format";
import type { Transaction, TransactionStatus } from "@/lib/data";
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

function isValidTransactionStatus(value: unknown): value is TransactionStatus {
  return typeof value === "string" && ["Received", "Washing", "Drying", "Ready", "Claimed", "Voided"].includes(value);
}

function normalizeStatus(value: unknown): TransactionStatus {
  if (value === "Drying") return "Washing";
  return isValidTransactionStatus(value) ? value : "Received";
}

function normalizePaymentStatus(value: unknown): Transaction["paymentStatus"] {
  return value === "paid" ? "paid" : "unpaid";
}

export function mapRealtimeRow(row: unknown): Transaction | null {
  if (!row || typeof row !== "object") {
    return null;
  }
  const r = row as Record<string, unknown>;

  const id = typeof r.id === "string" ? r.id : String(r.id ?? "");
  const ticketId = typeof r.ticket_id === "string" ? r.ticket_id : (typeof r.ticketId === "string" ? r.ticketId : "");
  if (!id && !ticketId) {
    return null;
  }

  const customerName = typeof r.customer_name === "string" ? r.customer_name : (typeof r.customerName === "string" ? r.customerName : "");
  const phone = typeof r.phone_number === "string" ? r.phone_number : (typeof r.phone === "string" ? r.phone : "");
  const arrivalTimeRaw = (typeof r.arrival_time === "string" ? r.arrival_time : (typeof r.created_at === "string" ? r.created_at : (typeof r.arrivalDateTime === "string" ? r.arrivalDateTime : null)));
  const arrivalDateTime = formatCompactDateTime(arrivalTimeRaw) || (typeof r.arrivalDateTime === "string" ? r.arrivalDateTime : "");
  const dropOffDate = formatCompactDate(arrivalTimeRaw) || (typeof r.dropOffDate === "string" ? r.dropOffDate : arrivalDateTime.split(" ")[0] || "");
  const status = normalizeStatus(r.status);
  const claimedTimeRaw = typeof r.claimed_at === "string" ? r.claimed_at : (typeof r.claimedAt === "string" ? r.claimedAt : null);
  const claimedAt = claimedTimeRaw ? formatCompactDateTime(claimedTimeRaw) || undefined : undefined;
  const voidedTimeRaw = typeof r.voided_at === "string" ? r.voided_at : (typeof r.voidedAt === "string" ? r.voidedAt : null);
  const voidedAt = voidedTimeRaw ? formatCompactDateTime(voidedTimeRaw) || undefined : undefined;

  const washType = typeof r.wash_type === "string" ? r.wash_type : (typeof r.washType === "string" ? r.washType : "Regular");
  const weight = typeof r.weight_kg === "number" ? r.weight_kg : (Number(r.weight_kg ?? r.weight ?? 0) || 0);
  const fee = typeof r.fee === "number" ? r.fee : (Number(r.fee ?? 0) || 0);
  const paymentStatus = normalizePaymentStatus(r.payment_status ?? r.paymentStatus);
  const addOns = Array.isArray(r.addons) ? r.addons.map(String) : (Array.isArray(r.addOns) ? r.addOns.map(String) : []);
  const washInstructions = typeof r.special_instructions === "string" ? r.special_instructions : (typeof r.washInstructions === "string" ? r.washInstructions : undefined);
  const publicTrackingToken = typeof r.public_tracking_token === "string" ? r.public_tracking_token : (typeof r.publicTrackingToken === "string" ? r.publicTrackingToken : undefined);
  const updatedAt = typeof r.updated_at === "string" ? r.updated_at : (typeof r.updatedAt === "string" ? r.updatedAt : undefined);
  const eta = typeof r.eta === "string" ? r.eta : (r.eta === null ? null : undefined);
  const voidReason = typeof r.void_reason === "string" ? r.void_reason : (typeof r.voidReason === "string" ? r.voidReason : undefined);

  return {
    id: id || ticketId,
    ticketId: ticketId || id,
    customerName,
    phone,
    arrivalDateTime,
    dropOffDate,
    claimedAt,
    voidedAt,
    washType,
    weight,
    fee,
    status,
    paymentStatus,
    addOns,
    washInstructions,
    publicTrackingToken,
    updatedAt,
    eta,
    voidReason,
  };
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
    throw new Error("Session expired. Please sign in again.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const transactionsRef = useRef<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"online" | "offline" | "syncing" | "error">(
    isOnline() ? "online" : "offline",
  );
  const [pendingChangesCount, setPendingChangesCount] = useState<number>(0);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const queueSyncInFlightRef = useRef(false);
  const hydratedRef = useRef(false);
  // Map of ticketId -> { version: number, optimisticTx: Transaction } to protect in-flight mutations against stale server overwrites
  const pendingMutationsRef = useRef<Map<string, { version: number; optimisticTx: Transaction }>>(new Map());
  const mutationVersionCounterRef = useRef(0);
  // P0-E: stable refs to avoid realtime channel re-subscribe on refresh identity change (caching)
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const processQueueRef = useRef<(() => Promise<void>) | null>(null);

  const persistTransactions = useCallback(async (next: Transaction[]) => {
    transactionsRef.current = next;
    setTransactions(next);
    await writeCachedTransactions(next);
  }, []);

  const updateTransactions = useCallback((updater: (current: Transaction[]) => Transaction[]) => {
    setTransactions((current) => {
      const next = updater(current);
      transactionsRef.current = next;
      void writeCachedTransactions(next);
      return next;
    });
  }, []);

  const hydrateOfflineState = useCallback(async () => {
    const [cached, queue] = await Promise.all([readCachedTransactions(), readOfflineQueue()]);
    if (cached.length > 0) {
      transactionsRef.current = cached;
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
      let headers: Record<string, string>;
      try {
        headers = await getAuthHeaders();
      } catch (authError) {
        const msg = authError instanceof Error ? authError.message : "Session expired. Please sign in again.";
        setError(msg);
        setLastSyncError(msg);
        setSyncStatus("error");
        return;
      }
      const response = await fetch("/api/transactions", {
        cache: "no-store",
        headers,
      });
      const data = await readJson<TransactionsResponse>(response);
      if (queue.length === 0) {
        // Merge server transactions while preserving any in-flight optimistic mutations
        const pending = pendingMutationsRef.current;
        let mergedTransactions = data.transactions;
        if (pending.size > 0) {
          mergedTransactions = data.transactions.map((serverTx) => {
            const pendingEntry = pending.get(serverTx.ticketId);
            return pendingEntry ? pendingEntry.optimisticTx : serverTx;
          });
        }
        await persistTransactions(mergedTransactions);
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
        await refreshRef.current?.();
      }
    } finally {
      queueSyncInFlightRef.current = false;
    }
  }, []);

  // keep refs in sync for caching (avoid re-subscribe)
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => { processQueueRef.current = processQueue; }, [processQueue]);

  useEffect(() => subscribeNetworkStatus((online) => {
    setSyncStatus(online ? "online" : "offline");
    if (online) {
      void processQueueRef.current?.();
      void refreshRef.current?.();
    }
  }), []);

  useEffect(() => {
    if (!isOnline()) {
      return;
    }

    void (async () => {
      if ((await readOfflineQueue()).length > 0) {
        await processQueueRef.current?.();
      }
    })();
  }, []);

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
          event: "INSERT",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          const mapped = mapRealtimeRow(payload.new);
          if (!mapped) {
            void refreshRef.current?.();
            return;
          }
          updateTransactions((current) => {
            const exists = current.some((t) => t.id === mapped.id || t.ticketId === mapped.ticketId);
            if (exists) {
              return current.map((t) => (t.id === mapped.id || t.ticketId === mapped.ticketId ? mapped : t));
            }
            return [mapped, ...current];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          const mapped = mapRealtimeRow(payload.new);
          if (!mapped) {
            void refreshRef.current?.();
            return;
          }
          updateTransactions((current) => {
            // If this ticket currently has an active in-flight mutation, do not let an older Realtime event overwrite it
            const pendingEntry = pendingMutationsRef.current.get(mapped.ticketId);
            const target = pendingEntry ? pendingEntry.optimisticTx : mapped;

            const exists = current.some((t) => t.id === target.id || t.ticketId === target.ticketId);
            if (exists) {
              return current.map((t) => (t.id === target.id || t.ticketId === target.ticketId ? target : t));
            }
            return [target, ...current];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          const oldRecord = payload.old as Record<string, unknown> | null;
          const targetId = typeof oldRecord?.id === "string" ? oldRecord.id : null;
          const targetTicketId = typeof oldRecord?.ticket_id === "string" ? oldRecord.ticket_id : null;
          if (!targetId && !targetTicketId) {
            void refreshRef.current?.();
            return;
          }
          updateTransactions((current) =>
            current.filter((t) => (targetId ? t.id !== targetId : true) && (targetTicketId ? t.ticketId !== targetTicketId : true)),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [updateTransactions]);

  // Window visibility & focus recovery refresh
  useEffect(() => {
    let focusTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleRecheck = () => {
      if (document.visibilityState === "hidden") return;
      if (focusTimeout) clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        void refreshRef.current?.();
      }, 300);
    };

    window.addEventListener("focus", handleRecheck);
    document.addEventListener("visibilitychange", handleRecheck);

    return () => {
      if (focusTimeout) clearTimeout(focusTimeout);
      window.removeEventListener("focus", handleRecheck);
      document.removeEventListener("visibilitychange", handleRecheck);
    };
  }, []);

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
      // P0-E: use functional update to avoid stale closure over `transactions`
      let optimistic: Transaction | null = null;
      updateTransactions((current) => {
        const found = current.find((t) => t.ticketId === ticketId);
        optimistic = found ? ({ ...found, ...updates } as Transaction) : ({ ticketId, ...updates } as unknown as Transaction);
        return current.map((transaction) =>
          transaction.ticketId === ticketId ? { ...transaction, ...updates } : transaction,
        );
      });
      return { transaction: (optimistic ?? ({ ticketId, ...updates } as Transaction)) };
    }

    // Apply optimistic update immediately for instant single-click UI responsiveness
    const currentVersion = ++mutationVersionCounterRef.current;
    const found = transactionsRef.current.find((t) => t.ticketId === ticketId);
    const originalTxn = found;
    const optimisticTxn: Transaction = found
      ? ({ ...found, ...updates } as Transaction)
      : ({ ticketId, ...updates } as unknown as Transaction);

    pendingMutationsRef.current.set(ticketId, {
      version: currentVersion,
      optimisticTx: optimisticTxn,
    });

    updateTransactions((current) =>
      current.map((transaction) =>
        transaction.ticketId === ticketId ? optimisticTxn : transaction,
      ),
    );

    try {
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
      // Clear pending mutation marker on authoritative server response
      const pendingEntry = pendingMutationsRef.current.get(ticketId);
      if (pendingEntry && pendingEntry.version === currentVersion) {
        pendingMutationsRef.current.delete(ticketId);
      }

      updateTransactions((current) =>
        current.map((transaction) =>
          transaction.ticketId === data.transaction.ticketId ? data.transaction : transaction,
        ),
      );
      return { transaction: data.transaction, loyaltyResult: data.loyaltyResult };
    } catch (err) {
      // Clear pending mutation marker on failure and revert if our version is still active
      const pendingEntry = pendingMutationsRef.current.get(ticketId);
      if (pendingEntry && pendingEntry.version === currentVersion) {
        pendingMutationsRef.current.delete(ticketId);
        if (originalTxn) {
          updateTransactions((current) =>
            current.map((transaction) =>
              transaction.ticketId === ticketId ? originalTxn! : transaction,
            ),
          );
        }
      }
      throw err;
    }
  }, [updateTransactions]);

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
