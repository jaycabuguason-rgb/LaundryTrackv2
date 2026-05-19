"use client";

import { useCallback, useEffect, useState } from "react";

import { staffAccounts as demoStaffAccounts } from "@/lib/auth";
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

const demoSeedStaff: StaffAccountSummary[] = demoStaffAccounts.map((account, index) => {
  const createdAt = index === 0 ? "2026-01-10T00:00:00.000Z" : "2026-02-14T00:00:00.000Z";
  return {
    id: `demo-staff-${index + 1}`,
    fullName: account.profile.name,
    email: account.profile.email,
    username: account.profile.username,
    phoneNumber: account.profile.phone,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  };
});

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
  const [staff, setStaff] = useState<StaffAccountSummary[]>(() => (supabase ? [] : demoSeedStaff));
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setStaff((current) => (current.length > 0 ? current : demoSeedStaff));
      setLoading(false);
      setError(null);
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
      const createdAt = new Date().toISOString();
      const staffAccount: StaffAccountSummary = {
        id: `demo-staff-${crypto.randomUUID()}`,
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        username: input.username.trim().toLowerCase(),
        phoneNumber: input.phoneNumber?.trim() ?? "",
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      };
      setStaff((current) => [staffAccount, ...current]);
      return staffAccount;
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
      const updatedAt = new Date().toISOString();
      let updatedStaffAccount: StaffAccountSummary | null = null;

      setStaff((current) =>
        current.map((item) => {
          if (item.id !== staffId) {
            return item;
          }

          updatedStaffAccount = {
            ...item,
            fullName: input.fullName.trim(),
            email: input.email.trim().toLowerCase(),
            username: input.username.trim().toLowerCase(),
            phoneNumber: input.phoneNumber?.trim() ?? "",
            isActive: input.isActive,
            updatedAt,
          };
          return updatedStaffAccount;
        }),
      );

      if (!updatedStaffAccount) {
        throw new Error("That staff account could not be found.");
      }

      return updatedStaffAccount;
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
      return;
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
