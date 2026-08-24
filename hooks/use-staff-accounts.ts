"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  CreateStaffAccountInput,
  StaffAccountSummary,
  UpdateStaffAccountInput,
} from "@/lib/staff-contracts";
import { getBrowserAccessToken } from "@/lib/supabase/browser-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface StaffListResponse {
  staff: StaffAccountSummary[];
}

interface StaffAccountResponse {
  staffAccount: StaffAccountSummary;
}

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

export function useStaffAccounts() {
  const supabase = getSupabaseBrowserClient();
  const [staff, setStaff] = useState<StaffAccountSummary[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(
    supabase ? null : "Supabase staff management is not configured.",
  );

  const refresh = useCallback(async () => {
    if (!supabase) {
      setStaff([]);
      setLoading(false);
      setError("Supabase staff management is not configured.");
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/staff", {
        cache: "no-store",
        headers,
      });
      const data = await readJson<StaffListResponse>(response);
      setStaff(data.staff);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load staff accounts.");
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
      .channel("laundrytrack-staff")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
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

  const createStaff = useCallback(async (input: CreateStaffAccountInput) => {
    if (!supabase) {
      throw new Error("Supabase staff management is not configured.");
    }

    const headers = await getAuthHeaders();
    const response = await fetch("/api/staff", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(input),
    });

    const data = await readJson<StaffAccountResponse>(response);
    setStaff((current) => [data.staffAccount, ...current.filter((item) => item.id !== data.staffAccount.id)]);
    return data.staffAccount;
  }, [supabase]);

  const updateStaff = useCallback(async (staffId: string, input: UpdateStaffAccountInput) => {
    if (!supabase) {
      throw new Error("Supabase staff management is not configured.");
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/staff/${encodeURIComponent(staffId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(input),
    });

    const data = await readJson<StaffAccountResponse>(response);
    setStaff((current) =>
      current.map((item) => (item.id === data.staffAccount.id ? data.staffAccount : item)),
    );
    return data.staffAccount;
  }, [supabase]);

  const resetPassword = useCallback(async (staffId: string, password: string) => {
    if (!supabase) {
      throw new Error("Supabase staff management is not configured.");
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/staff/${encodeURIComponent(staffId)}/password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ password }),
    });

    await readJson<{ success: true }>(response);
  }, [supabase]);

  return {
    staff,
    loading,
    error,
    refresh,
    createStaff,
    updateStaff,
    resetPassword,
    usingSupabase: Boolean(supabase),
  };
}
