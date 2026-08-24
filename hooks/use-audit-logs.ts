"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AuditLogEntry } from "@/lib/audit-log-contracts";
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
    throw new Error("No active admin session was found.");
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

export function useAuditLogs() {
  const supabase = getSupabaseBrowserClient();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => (supabase ? [] : FALLBACK_AUDIT_LOGS));
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    const channel = supabase
      .channel("laundrytrack-audit-logs")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "audit_logs",
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, supabase]);

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
  };
}
