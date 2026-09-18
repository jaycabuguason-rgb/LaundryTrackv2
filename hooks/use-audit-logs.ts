"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AuditActionType, AuditLogEntry, AuditStaffRole } from "@/lib/audit-log-contracts";
import type { PaymentStatus } from "@/lib/data";
import {
  getBrowserAccessToken,
  refreshBrowserSession,
} from "@/lib/supabase/browser-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuditLogsResponse {
  auditLogs: AuditLogEntry[];
}

const FALLBACK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "AL-001",
    timestamp: "2026-04-15T14:32:00",
    staffName: "Maria Santos",
    staffRole: "Staff",
    action: "transaction_created",
    summary: "Created transaction TKT-0012",
    details: "Customer: Jose Reyes | Service: Full Wash | Fee: PHP 250 | Drop-off: 2026-04-15",
    ticketId: "TKT-0012",
    ipAddress: "192.168.1.10",
  },
  {
    id: "AL-002",
    timestamp: "2026-04-15T13:45:00",
    staffName: "Juan dela Cruz",
    staffRole: "Staff",
    action: "claim_verified",
    summary: "Verified claim for TKT-0008",
    details: "Customer: Ana Reyes | QR scan successful | Item released at counter",
    ticketId: "TKT-0008",
    ipAddress: "192.168.1.11",
  },
  {
    id: "AL-003",
    timestamp: "2026-04-15T12:10:00",
    staffName: "Admin",
    staffRole: "Admin",
    action: "settings_changed",
    summary: "Updated pricing settings",
    details: "Changed full wash rate from PHP 220 to PHP 250 | Add-on: Fabric conditioner set to PHP 30",
    ipAddress: "192.168.1.1",
  },
];

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data && typeof data.error === "string"
        ? data.error
        : "Request failed.";
    throw new Error(message);
  }
  return data as T;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getBrowserAccessToken();
  if (!accessToken) {
    throw new Error("No active session was found.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function fetchAuditLogsWithAuthRetry(): Promise<AuditLogEntry[]> {
  let headers = await getAuthHeaders();
  let response = await fetch("/api/audit-logs", {
    cache: "no-store",
    headers,
  });

  if (response.status === 401) {
    const refreshedSession = await refreshBrowserSession().catch(() => null);
    if (refreshedSession?.access_token) {
      headers = {
        Authorization: `Bearer ${refreshedSession.access_token}`,
      };
      response = await fetch("/api/audit-logs", {
        cache: "no-store",
        headers,
      });
    }
  }

  const data = await readJson<AuditLogsResponse>(response);
  return data.auditLogs;
}

export function mapRealtimeAuditRow(record: unknown): AuditLogEntry | null {
  if (!record || typeof record !== "object") return null;
  const row = record as Record<string, unknown>;
  if (typeof row.id !== "string") return null;

  let rawMetadata: Record<string, unknown> | undefined;
  if (typeof row.metadata === "object" && row.metadata !== null) {
    rawMetadata = row.metadata as Record<string, unknown>;
  } else if (typeof row.metadata === "string") {
    try {
      rawMetadata = JSON.parse(row.metadata);
    } catch {
      rawMetadata = undefined;
    }
  }
  const correlationId =
    typeof rawMetadata?.correlationId === "string" ? rawMetadata.correlationId : undefined;

  const rawRole = typeof row.staff_role === "string" ? row.staff_role.toLowerCase() : "";
  const staffRole: AuditStaffRole =
    rawRole === "admin" ? "Admin" : rawRole === "staff" ? "Staff" : "System";

  return {
    id: row.id,
    timestamp: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    staffName: typeof row.staff_name === "string" && row.staff_name ? row.staff_name : "System",
    staffRole,
    action: (typeof row.action === "string" ? row.action : "other") as AuditActionType,
    summary: typeof row.summary === "string" ? row.summary : "Audit event",
    details: typeof row.notes === "string" ? row.notes : "No additional details.",
    ticketId: typeof row.ticket_id === "string" ? row.ticket_id : undefined,
    customerName: typeof row.customer_name === "string" ? row.customer_name : undefined,
    paymentStatus:
      typeof row.payment_status === "string" ? (row.payment_status as PaymentStatus) : undefined,
    ipAddress: typeof row.ip_address === "string" ? row.ip_address : undefined,
    clientCorrelationId: correlationId,
  };
}

export interface LogVerificationEventInput {
  action: AuditActionType;
  ticketId?: string;
  summary?: string;
  details?: string;
  customerName?: string;
  paymentStatus?: PaymentStatus;
  metadata?: Record<string, unknown>;
}

export function useAuditLogs() {
  const supabase = getSupabaseBrowserClient();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => (supabase ? [] : FALLBACK_AUDIT_LOGS));
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);

  const refreshRef = useRef<() => Promise<void>>(undefined);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setAuditLogs(FALLBACK_AUDIT_LOGS);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const nextAuditLogs = await fetchAuditLogsWithAuthRetry();
      setAuditLogs(nextAuditLogs);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  refreshRef.current = refresh;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime subscription with direct INSERT reconciliation and duplicate prevention
  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    const channel = supabase
      .channel("laundrytrack-audit-logs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
        },
        (payload) => {
          const mapped = mapRealtimeAuditRow(payload.new);
          if (!mapped) {
            void refreshRef.current?.();
            return;
          }

          setAuditLogs((current) => {
            const correlationId = mapped.clientCorrelationId;
            const hasOptimisticMatch = correlationId
              ? current.some((item) => item.clientCorrelationId === correlationId)
              : false;

            if (hasOptimisticMatch) {
              return current.map((item) =>
                item.clientCorrelationId === correlationId ? mapped : item
              );
            }

            // Deduplicate by database id
            if (current.some((item) => item.id === mapped.id)) {
              return current;
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
          table: "audit_logs",
        },
        (payload) => {
          const mapped = mapRealtimeAuditRow(payload.new);
          if (!mapped) {
            void refreshRef.current?.();
            return;
          }

          setAuditLogs((current) =>
            current.map((item) =>
              item.id === mapped.id ||
              (mapped.clientCorrelationId && item.clientCorrelationId === mapped.clientCorrelationId)
                ? mapped
                : item
            )
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "audit_logs",
        },
        (payload) => {
          const oldRecord = payload.old as Record<string, unknown> | null;
          const targetId = typeof oldRecord?.id === "string" ? oldRecord.id : null;
          if (!targetId) {
            void refreshRef.current?.();
            return;
          }
          setAuditLogs((current) => current.filter((item) => item.id !== targetId));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

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

  const logVerificationEvent = useCallback(
    async (input: LogVerificationEventInput): Promise<AuditLogEntry | null> => {
      const clientCorrelationId =
        "corr_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
      const optimisticEntry: AuditLogEntry = {
        id: "temp_" + clientCorrelationId,
        timestamp: new Date().toISOString(),
        staffName: "Staff",
        staffRole: "Staff",
        action: input.action,
        summary: input.summary || `${input.action} for ${input.ticketId || "order"}`,
        details: input.details || "",
        ticketId: input.ticketId,
        customerName: input.customerName,
        paymentStatus: input.paymentStatus,
        clientCorrelationId,
        isPending: true,
      };

      // Optimistically prepend to state immediately
      setAuditLogs((prev) => [optimisticEntry, ...prev]);

      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/audit-logs", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: input.action,
            ticketId: input.ticketId,
            summary: input.summary,
            details: input.details,
            customerName: input.customerName,
            paymentStatus: input.paymentStatus,
            correlationId: clientCorrelationId,
            metadata: input.metadata,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to persist audit log");
        }

        const data = (await res.json()) as { auditLog: AuditLogEntry };
        const serverEntry = data.auditLog;

        // Replace optimistic entry with server-confirmed entry
        setAuditLogs((current) =>
          current.map((item) =>
            item.clientCorrelationId === clientCorrelationId || item.id === optimisticEntry.id
              ? serverEntry
              : item
          )
        );

        return serverEntry;
      } catch {
        // Roll back or mark as unsaved
        setAuditLogs((current) =>
          current.map((item) =>
            item.clientCorrelationId === clientCorrelationId
              ? { ...item, isPending: false, isUnsaved: true }
              : item
          )
        );
        return null;
      }
    },
    [],
  );

  const staffOptions = useMemo(() => {
    const names = new Set<string>(["All Staff"]);
    for (const entry of auditLogs) {
      if (entry.staffRole === "Admin") {
        names.add("Admin");
      } else if (entry.staffName && entry.staffRole === "Staff") {
        names.add(entry.staffName);
      }
    }
    return [...names];
  }, [auditLogs]);

  return {
    auditLogs,
    loading,
    error,
    refresh,
    staffOptions,
    usingSupabase: Boolean(supabase),
    logVerificationEvent,
  };
}
