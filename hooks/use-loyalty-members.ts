"use client";

import { useState, useEffect } from "react";
import { type LoyaltyMember } from "@/lib/data";
import { getBrowserAccessToken, refreshBrowserSession } from "@/lib/supabase/browser-session";

interface UseLoyaltyMembersResult {
  members: LoyaltyMember[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useLoyaltyMembers(): UseLoyaltyMembersResult {
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      let accessToken = await getBrowserAccessToken();
      if (!accessToken) {
        const refreshed = await refreshBrowserSession();
        accessToken = refreshed?.access_token ?? null;
      }

      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      return fetch("/api/loyalty", { headers });
    };

    load()
      .then(async (res) => {
        const data = await res.json() as { members?: LoyaltyMember[]; error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load members");
        setMembers(data.members ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load members");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  return { members, loading, error, refetch: () => setTick((t) => t + 1) };
}
