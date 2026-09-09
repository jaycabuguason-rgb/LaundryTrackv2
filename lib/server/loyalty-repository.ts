import "server-only";

import { loyaltyMembers as seedMembers, type LoyaltyMember } from "@/lib/data";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { listTransactions, getBusinessProfile } from "@/lib/server/laundry-repository";
import type { PublicLoyaltyMemberRecord, PublicShopProfile } from "@/lib/transaction-contracts";

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
  email?: string | null;
  stamp_count: number;
  rewards_redeemed: number;
  rewards_available?: number;
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
      rewardsAvailable: 0,
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
      stamp_count: 0,
      rewards_redeemed: 0,
      date_joined: new Date().toISOString().split("T")[0],
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
): Promise<LoyaltyMember> {
  if (!hasSupabaseConfig()) {
    let updatedMember: LoyaltyMember | undefined;
    mockMembers = mockMembers.map((m) => {
      if (m.id === memberId) {
        const newStampCount = Math.max(0, m.stampCount + stamps);
        const updated: LoyaltyMember = {
          ...m,
          stampCount: newStampCount,
          stampHistory: [
            {
              date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
              stamps,
              ticket: stamps < 0 ? "Undo Adjustment" : "Manual Entry",
              notes,
            },
            ...(m.stampHistory || []),
          ],
        };
        updatedMember = updated;
        return updated;
      }
      return m;
    });
    if (!updatedMember) throw new Error("Member not found");
    return updatedMember;
  }

  const rows = await restRequest<LoyaltyMemberRow[]>(
    `loyalty_members?id=eq.${encodeURIComponent(memberId)}&select=stamp_count`
  );
  if (rows.length === 0) throw new Error("Member not found");

  const newCount = Math.max(0, rows[0].stamp_count + stamps);
  await restRequest(`loyalty_members?id=eq.${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    body: JSON.stringify({ stamp_count: newCount }),
  });

  try {
    await restRequest(`stamp_history`, {
      method: "POST",
      body: JSON.stringify({
        member_id: memberId,
        stamps_added: stamps,
        source: "manual",
        notes: notes,
      }),
    });
  } catch {
    try {
      await restRequest(`stamp_history`, {
        method: "POST",
        body: JSON.stringify({
          member_id: memberId,
          stamps_added: stamps,
        }),
      });
    } catch {
      // Non-fatal if stamp_history table schema differs
    }
  }

  return await getLoyaltyMemberWithHistory(memberId);
}

export async function getLoyaltySettings(): Promise<{ loyalty_enabled: boolean; washes_per_reward: number; reward_description: string }> {
  if (!hasSupabaseConfig()) return { loyalty_enabled: true, washes_per_reward: 7, reward_description: "Free wash" };
  try {
    const rows = await restRequest<Array<{ key: string; value: { enabled?: boolean; washesPerReward?: number; rewardDescription?: string } }>>("settings?key=eq.loyalty&select=key,value&limit=1");
    if (rows && rows[0]?.value) {
      const val = rows[0].value;
      return {
        loyalty_enabled: val.enabled ?? true,
        washes_per_reward: Number(val.washesPerReward) || 7,
        reward_description: val.rewardDescription || "Free wash",
      };
    }
  } catch {
    // fallback if error
  }
  return { loyalty_enabled: true, washes_per_reward: 7, reward_description: "Free wash" };
}

export async function getLoyaltyMemberWithHistory(memberId: string): Promise<LoyaltyMember> {
  if (!hasSupabaseConfig()) {
    const member = mockMembers.find((m) => m.id === memberId);
    if (!member) throw new Error("Member not found");
    return member;
  }

  // 1. Fetch member
  const rows = await restRequest<LoyaltyMemberRow[]>(
    `loyalty_members?id=eq.${encodeURIComponent(memberId)}&select=id,full_name,phone_number,stamp_count,rewards_redeemed,preferences,date_joined,created_at`
  );
  if (!rows || rows.length === 0) throw new Error("Member not found");
  const member = mapRowToMember(rows[0]);

  // 2. Fetch stamp history
  let stamps: StampHistoryRow[] = [];
  try {
    const rawStamps = await restRequest<StampHistoryRow[]>(
      `stamp_history?member_id=eq.${encodeURIComponent(memberId)}&select=id,member_id,transaction_id,stamps_added,created_at&order=created_at.desc`
    );
    stamps = Array.isArray(rawStamps) ? rawStamps : [];
  } catch {
    stamps = [];
  }

  // 3. Fetch reward history
  let rewards: RewardHistoryRow[] = [];
  try {
    const rawRewards = await restRequest<RewardHistoryRow[]>(
      `reward_history?member_id=eq.${encodeURIComponent(memberId)}&select=id,member_id,reward_type,redeemed_at&order=redeemed_at.desc`
    );
    rewards = Array.isArray(rawRewards) ? rawRewards : [];
  } catch {
    rewards = [];
  }

  member.stampHistory = stamps.map((s) => ({
    date: s.created_at ? new Date(s.created_at).toISOString().split("T")[0] : "",
    stamps: s.stamps_added,
    ticket: s.transaction_id ? `TKT-${s.transaction_id.slice(0, 4)}` : "Manual",
    source: "manual",
    notes: undefined,
  }));

  member.rewardHistory = rewards.map((r) => ({
    date: r.redeemed_at ? new Date(r.redeemed_at).toISOString().split("T")[0] : "",
    reward: r.reward_type ?? "Free Wash",
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
    `loyalty_members?${memberQuery}&select=id,full_name,stamp_count`
  );
  if (!memberRows || memberRows.length === 0) {
    return { stamped: false, reason: "Customer is not a registered loyalty member" };
  }
  const member = memberRows[0];

  // 3. Check if stamp already awarded for this transaction
  const existingStamps = await restRequest<Array<{ id: string }>>(
    `stamp_history?transaction_id=eq.${encodeURIComponent(transactionId)}&select=id`
  );
  if (existingStamps && existingStamps.length > 0) {
    return { stamped: false, reason: "Stamp already awarded for this transaction" };
  }

  // 4. Calculate new counts
  const currentStamps = member.stamp_count;
  const newStamps = currentStamps + 1;
  const earnedReward = (newStamps % settings.washes_per_reward) === 0;
  const newRewardsAvailable = earnedReward ? (member.rewards_available || 0) + 1 : (member.rewards_available || 0);

  // 5. Update member
  await restRequest(`loyalty_members?id=eq.${encodeURIComponent(member.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      stamp_count: newStamps
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

function cleanPhone(num: string | null | undefined): string {
  return (num || "").replace(/\D/g, "");
}

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

export async function getPublicLoyaltyMemberRecord(
  memberIdentifier: string
): Promise<PublicLoyaltyMemberRecord | null> {
  const cleanId = memberIdentifier.trim();
  if (!cleanId) return null;

  // Extract ID if passed as MEM-0001 or URL
  const memMatch = cleanId.match(/MEM-([0-9]+)/i);
  const normalizedId = memMatch ? String(Number.parseInt(memMatch[1], 10)) : cleanId;

  // 1. Fetch member with history
  let member: LoyaltyMember | null = null;
  if (!hasSupabaseConfig()) {
    member =
      mockMembers.find(
        (m) =>
          m.id === normalizedId ||
          m.id === cleanId ||
          (cleanPhone(m.phone) && cleanPhone(m.phone) === cleanPhone(cleanId)) ||
          m.name.toLowerCase() === cleanId.toLowerCase()
      ) || null;
  } else {
    try {
      let rows: LoyaltyMemberRow[] = [];
      if (isUuid(cleanId)) {
        rows = await restRequest<LoyaltyMemberRow[]>(
          `loyalty_members?id=eq.${encodeURIComponent(cleanId)}&select=id,full_name,phone_number,stamp_count,rewards_redeemed,preferences,date_joined,created_at&limit=1`
        );
      } else if (isUuid(normalizedId)) {
        rows = await restRequest<LoyaltyMemberRow[]>(
          `loyalty_members?id=eq.${encodeURIComponent(normalizedId)}&select=id,full_name,phone_number,stamp_count,rewards_redeemed,preferences,date_joined,created_at&limit=1`
        );
      } else {
        rows = await restRequest<LoyaltyMemberRow[]>(
          `loyalty_members?or=(phone_number.eq.${encodeURIComponent(cleanId)},full_name.ilike.${encodeURIComponent(cleanId)})&select=id,full_name,phone_number,stamp_count,rewards_redeemed,preferences,date_joined,created_at&limit=1`
        );
      }

      if (rows && rows.length > 0) {
        member = await getLoyaltyMemberWithHistory(rows[0].id);
      }
    } catch {
      // ignore
    }

    if (!member) {
      member =
        mockMembers.find(
          (m) =>
            m.id === normalizedId ||
            m.id === cleanId ||
            (cleanPhone(m.phone) && cleanPhone(m.phone) === cleanPhone(cleanId)) ||
            m.name.toLowerCase() === cleanId.toLowerCase()
        ) || null;
    }
  }

  if (!member) return null;

  const [allTxns, profile, settings] = await Promise.all([
    listTransactions(),
    getBusinessProfile(),
    getLoyaltySettings(),
  ]);

  const memberPhoneClean = cleanPhone(member.phone);
  const memberNameLower = member.name.trim().toLowerCase();

  // Find matching laundry orders from transactions
  const memberTxns = allTxns.filter((t) => {
    const tPhoneClean = cleanPhone(t.phone);
    if (memberPhoneClean && tPhoneClean && memberPhoneClean === tPhoneClean) return true;
    if (t.customerName && t.customerName.trim().toLowerCase() === memberNameLower) return true;
    return false;
  });

  const washesPerReward = settings.washes_per_reward || 7;
  const currentCycleStamps = member.stampCount % washesPerReward;
  const stampsUntilReward = washesPerReward - currentCycleStamps;
  const progressPct = Math.min(100, Math.round((currentCycleStamps / washesPerReward) * 100));

  const totalKgWashed = Number(
    memberTxns.reduce((acc, t) => acc + (Number(t.weight) || 0), 0).toFixed(1)
  );
  const totalVisits = Math.max(memberTxns.length, member.stampCount);

  const laundryRecords: PublicLoyaltyMemberRecord["laundryRecords"] = memberTxns.map((t) => {
    const status = t.status === "Drying" ? "Washing" : t.status;
    const isClaimed = status === "Claimed";
    const dropOffTime = t.arrivalDateTime || t.dropOffDate || "";
    const claimedTime = isClaimed ? (t.claimedAt || t.updatedAt || dropOffTime) : null;

    return {
      ticketId: t.ticketId,
      date: dropOffTime,
      claimedDate: claimedTime,
      washType: t.washType || "Regular",
      weight: Number(t.weight) || 0,
      fee: Number(t.fee) || 0,
      status,
      rewardUsed: t.fee === 0 || (t.washInstructions || "").toLowerCase().includes("reward"),
    };
  });

  // Merge any tickets in stampHistory that weren't in memberTxns
  const existingTickets = new Set(laundryRecords.map((r) => r.ticketId));
  if (member.stampHistory && member.stampHistory.length > 0) {
    for (const sh of member.stampHistory) {
      if (sh.ticket && sh.ticket !== "Manual" && !existingTickets.has(sh.ticket)) {
        existingTickets.add(sh.ticket);
        laundryRecords.push({
          ticketId: sh.ticket,
          date: sh.date,
          claimedDate: sh.date,
          washType: "Regular",
          weight: 0,
          fee: 0,
          status: "Claimed",
          rewardUsed: false,
        });
      }
    }
  }

  // Sort laundry records by date descending
  laundryRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const shopProfile: PublicShopProfile = {
    shopName: profile.shopName,
    tagline: profile.tagline,
    logoDataUrl: profile.logoDataUrl,
    address: profile.address,
    contactNumber: profile.contactNumber,
    email: profile.email,
    receiptFooter: profile.receiptFooter,
    pickupInstructions: profile.pickupInstructions,
  };

  return {
    id: member.id,
    name: member.name,
    phone: member.phone,
    dateJoined: member.dateJoined,
    stampCount: member.stampCount,
    currentCycleStamps,
    washesPerReward,
    stampsUntilReward,
    progressPct,
    rewardsAvailable: Math.max(
      0,
      Math.floor(member.stampCount / washesPerReward) - (member.rewardsRedeemed || 0)
    ),
    rewardsRedeemed: member.rewardsRedeemed || 0,
    rewardDescription: settings.reward_description || "Free wash",
    totalVisits,
    totalKgWashed,
    laundryRecords,
    rewardHistory: member.rewardHistory || [],
    shopProfile,
  };
}
