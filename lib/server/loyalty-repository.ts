import "server-only";

import { loyaltyMembers as seedMembers, type LoyaltyMember } from "@/lib/data";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

type LoyaltyMemberRow = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  stamp_count: number;
  rewards_redeemed: number;
  preferences: string;
  date_joined: string;
  created_at: string;
};

function hasSupabaseConfig(): boolean {
  return Boolean(getPublicSupabaseConfig() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseConfig() {
  const publicConfig = getPublicSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicConfig || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }
  return { ...publicConfig, serviceRoleKey };
}

async function restRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

function mapRowToMember(row: LoyaltyMemberRow): LoyaltyMember {
  return {
    id: row.id,
    name: row.full_name ?? "",
    phone: row.phone_number ?? "",
    stampCount: row.stamp_count,
    rewardsRedeemed: row.rewards_redeemed,
    dateJoined: row.date_joined
      ? new Date(row.date_joined).toISOString().split("T")[0]
      : new Date(row.created_at).toISOString().split("T")[0],
    stampHistory: [],
    rewardHistory: [],
    preferences: row.preferences ?? "",
  };
}

// ── Mock fallback ────────────────────────────────────────────────────────────

let mockMembers: LoyaltyMember[] = [...seedMembers];

// ── Public API ───────────────────────────────────────────────────────────────

export async function listLoyaltyMembers(): Promise<LoyaltyMember[]> {
  if (!hasSupabaseConfig()) return [...mockMembers];

  const rows = await restRequest<LoyaltyMemberRow[]>(
    "loyalty_members?select=id,full_name,phone_number,stamp_count,rewards_redeemed,preferences,date_joined,created_at&order=date_joined.desc"
  );
  return rows.map(mapRowToMember);
}

export async function createLoyaltyMember(input: {
  name: string;
  phone?: string;
  preferences?: string;
}): Promise<LoyaltyMember> {
  if (!hasSupabaseConfig()) {
    const newMember: LoyaltyMember = {
      id: String(Date.now()),
      name: input.name.trim(),
      phone: input.phone?.trim() ?? "",
      stampCount: 0,
      rewardsRedeemed: 0,
      dateJoined: new Date().toISOString().split("T")[0],
      stampHistory: [],
      rewardHistory: [],
      preferences: input.preferences ?? "",
    };
    mockMembers = [newMember, ...mockMembers];
    return newMember;
  }

  const rows = await restRequest<LoyaltyMemberRow[]>("loyalty_members?select=id,full_name,phone_number,stamp_count,rewards_redeemed,preferences,date_joined,created_at", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      full_name: input.name.trim(),
      phone_number: input.phone?.trim() || null,
      preferences: input.preferences ?? "",
    }),
  });

  return mapRowToMember(rows[0]);
}

export async function updateLoyaltyMemberStamps(
  memberId: string,
  stampCount: number
): Promise<void> {
  if (!hasSupabaseConfig()) {
    mockMembers = mockMembers.map((m) =>
      m.id === memberId ? { ...m, stampCount } : m
    );
    return;
  }

  await restRequest(`loyalty_members?id=eq.${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    body: JSON.stringify({ stamp_count: stampCount }),
  });
}

export async function updateLoyaltyMember(
  memberId: string,
  input: { name?: string; phone?: string; preferences?: string }
): Promise<void> {
  if (!hasSupabaseConfig()) {
    mockMembers = mockMembers.map((m) =>
      m.id === memberId
        ? {
            ...m,
            name: input.name ?? m.name,
            phone: input.phone ?? m.phone,
            preferences: input.preferences ?? m.preferences,
          }
        : m
    );
    return;
  }

  const updates: Record<string, string | null> = {};
  if (input.name !== undefined) updates.full_name = input.name.trim();
  if (input.phone !== undefined) updates.phone_number = input.phone.trim() || null;
  if (input.preferences !== undefined) updates.preferences = input.preferences;

  await restRequest(`loyalty_members?id=eq.${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteLoyaltyMember(memberId: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    mockMembers = mockMembers.filter((m) => m.id !== memberId);
    return;
  }

  await restRequest(`loyalty_members?id=eq.${encodeURIComponent(memberId)}`, {
    method: "DELETE",
  });
}

export async function addStampsToMember(
  memberId: string,
  stamps: number
): Promise<void> {
  if (!hasSupabaseConfig()) {
    mockMembers = mockMembers.map((m) =>
      m.id === memberId ? { ...m, stampCount: m.stampCount + stamps } : m
    );
    return;
  }

  const rows = await restRequest<LoyaltyMemberRow[]>(
    `loyalty_members?id=eq.${encodeURIComponent(memberId)}&select=stamp_count`
  );
  if (rows.length === 0) throw new Error("Member not found");

  const newCount = rows[0].stamp_count + stamps;
  await restRequest(`loyalty_members?id=eq.${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    body: JSON.stringify({ stamp_count: newCount }),
  });
}
