import "server-only";

import { loyaltyMembers as seedMembers, type LoyaltyMember } from "@/lib/data";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export type StampAwardResult =
  | { stamped: false; reason: string }
  | {
    stamped: true;
    rewarded: boolean;
    memberName: string;
    newStampCount: number;
    cycleStampCount: number;
    washesPerReward: number;
    rewardsAvailable: number;
    rewardDescription: string;
  };

type LoyaltyMemberRow = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
  stamp_count: number;
  rewards_redeemed: number;
  rewards_available: number;
  preferences: string;
  date_joined: string;
  created_at: string;
};

type StampHistoryRow = {
  id: string;
  member_id: string;
  transaction_id: string | null;
  stamps_added: number;
  source: "auto_claim" | "manual";
  notes?: string | null;
  created_at: string;
  transactions?: { ticket_id: string } | null;
};

type RewardHistoryRow = {
  id: string;
  member_id: string;
  reward_type: string | null;
  redeemed_at: string;
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
    email: row.email ?? undefined,
    phone: row.phone_number ?? "",
    stampCount: row.stamp_count,
    rewardsAvailable: row.rewards_available ?? 0,
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
    "loyalty_members?select=id,full_name,phone_number,email,stamp_count,rewards_redeemed,rewards_available,preferences,date_joined,created_at&order=date_joined.desc"
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
      rewardsAvailable: 0,
      dateJoined: new Date().toISOString().split("T")[0],
      stampHistory: [],
      rewardHistory: [],
      preferences: input.preferences ?? "",
    };
    mockMembers = [newMember, ...mockMembers];
    return newMember;
  }

  const rows = await restRequest<LoyaltyMemberRow[]>("loyalty_members?select=id,full_name,phone_number,email,stamp_count,rewards_redeemed,rewards_available,preferences,date_joined,created_at", {
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
  stamps: number,
  notes: string = "Manual entry"
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

  await restRequest(`stamp_history`, {
    method: "POST",
    body: JSON.stringify({
      member_id: memberId,
      stamps_added: stamps,
      source: "manual",
      notes: notes,
    }),
  });
}

export async function getLoyaltySettings(): Promise<{ loyalty_enabled: boolean; washes_per_reward: number; reward_description: string }> {
  if (!hasSupabaseConfig()) return { loyalty_enabled: true, washes_per_reward: 10, reward_description: "Free Wash" };
  const rows = await restRequest<any[]>("settings?select=loyalty_enabled,washes_per_reward,reward_description");
  if (!rows || rows.length === 0) return { loyalty_enabled: true, washes_per_reward: 10, reward_description: "Free Wash" };
  return rows[0];
}

export async function getLoyaltyMemberWithHistory(memberId: string): Promise<LoyaltyMember> {
  if (!hasSupabaseConfig()) {
    const member = mockMembers.find((m) => m.id === memberId);
    if (!member) throw new Error("Member not found");
    return member;
  }

  // 1. Fetch member
  const rows = await restRequest<LoyaltyMemberRow[]>(
    `loyalty_members?id=eq.${encodeURIComponent(memberId)}&select=id,full_name,phone_number,email,stamp_count,rewards_redeemed,rewards_available,preferences,date_joined,created_at`
  );
  if (!rows || rows.length === 0) throw new Error("Member not found");
  const member = mapRowToMember(rows[0]);

  // 2. Fetch stamp history
  const stamps = await restRequest<StampHistoryRow[]>(
    `stamp_history?member_id=eq.${encodeURIComponent(memberId)}&select=id,member_id,transaction_id,stamps_added,source,notes,created_at,transactions(ticket_id)&order=created_at.desc`
  );

  // 3. Fetch reward history
  const rewards = await restRequest<RewardHistoryRow[]>(
    `reward_history?member_id=eq.${encodeURIComponent(memberId)}&select=id,member_id,reward_type,redeemed_at&order=redeemed_at.desc`
  );

  member.stampHistory = stamps.map((s) => ({
    date: new Date(s.created_at).toISOString().split("T")[0],
    stamps: s.stamps_added,
    ticket: s.transactions?.ticket_id ?? "Manual",
    source: s.source as "auto_claim" | "manual",
    notes: s.notes ?? undefined,
  }));

  member.rewardHistory = rewards.map((r) => ({
    date: new Date(r.redeemed_at).toISOString().split("T")[0],
    reward: r.reward_type ?? "Unknown Reward",
  }));

  return member;
}

export async function awardClaimStamp(
  transactionId: string,
  phone: string | null,
  email: string | null
): Promise<StampAwardResult> {
  if (!hasSupabaseConfig()) return { stamped: false, reason: "Supabase not configured" };

  // 1. Check if loyalty is enabled
  const settings = await getLoyaltySettings();
  if (!settings.loyalty_enabled) {
    return { stamped: false, reason: "Loyalty program is disabled" };
  }

  // 2. Find member by phone or email
  let memberQuery = "";
  if (phone && email) {
    memberQuery = `or=(phone_number.eq.${encodeURIComponent(phone)},email.eq.${encodeURIComponent(email)})`;
  } else if (phone) {
    memberQuery = `phone_number=eq.${encodeURIComponent(phone)}`;
  } else if (email) {
    memberQuery = `email=eq.${encodeURIComponent(email)}`;
  } else {
    return { stamped: false, reason: "No phone or email provided for customer" };
  }

  const memberRows = await restRequest<LoyaltyMemberRow[]>(
    `loyalty_members?${memberQuery}&select=id,full_name,stamp_count,rewards_available`
  );
  if (!memberRows || memberRows.length === 0) {
    return { stamped: false, reason: "Customer is not a registered loyalty member" };
  }
  const member = memberRows[0];

  // 3. Check if stamp already awarded for this transaction
  const existingStamps = await restRequest<any[]>(
    `stamp_history?transaction_id=eq.${encodeURIComponent(transactionId)}&select=id`
  );
  if (existingStamps && existingStamps.length > 0) {
    return { stamped: false, reason: "Stamp already awarded for this transaction" };
  }

  // 4. Calculate new counts
  const currentStamps = member.stamp_count;
  const newStamps = currentStamps + 1;
  const earnedReward = (newStamps % settings.washes_per_reward) === 0;
  const newRewardsAvailable = earnedReward ? member.rewards_available + 1 : member.rewards_available;

  // 5. Update member
  await restRequest(`loyalty_members?id=eq.${encodeURIComponent(member.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      stamp_count: newStamps,
      rewards_available: newRewardsAvailable
    })
  });

  // 6. Insert stamp history
  await restRequest(`stamp_history`, {
    method: "POST",
    body: JSON.stringify({
      member_id: member.id,
      transaction_id: transactionId,
      stamps_added: 1,
      source: "auto_claim"
    })
  });

  return {
    stamped: true,
    rewarded: earnedReward,
    memberName: member.full_name || "Customer",
    newStampCount: newStamps,
    cycleStampCount: newStamps % settings.washes_per_reward === 0 ? settings.washes_per_reward : newStamps % settings.washes_per_reward,
    washesPerReward: settings.washes_per_reward,
    rewardsAvailable: newRewardsAvailable,
    rewardDescription: settings.reward_description
  };
}
