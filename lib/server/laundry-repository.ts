import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { DEFAULT_BUSINESS_PROFILE, normalizeBusinessProfile, type BusinessProfile } from "@/lib/business-profile";
import { formatCompactDate, formatCompactDateTime } from "@/lib/date-format";
import {
  type Transaction,
  type TransactionStatus,
  transactions as seedTransactions,
} from "@/lib/data";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { createTtlCache } from "@/lib/server/ttl-cache";
import type {
  CreateTransactionInput,
  PublicShopProfile,
  PublicTrackingRecord,
  UpdateTransactionInput,
} from "@/lib/transaction-contracts";
import type { PricingConfig } from "@/lib/settings-store";

type TransactionRow = {
  id: string;
  ticket_id: string;
  customer_name: string;
  phone_number: string | null;
  wash_type: string;
  weight_kg: number | null;
  addons: string[] | null;
  special_instructions: string | null;
  fee: number;
  status: string;
  payment_status: string | null;
  public_tracking_token: string | null;
  eta: string | null;
  arrival_time: string | null;
  claimed_at?: string | null;
  voided_at?: string | null;
  paid_at?: string | null;
  updated_at: string | null;
  created_at: string | null;
  void_reason: string | null;
};

type SettingsRow<T = unknown> = {
  key: string;
  value: T;
};

const TRANSACTION_SELECT =
  "id,ticket_id,customer_name,phone_number,wash_type,weight_kg,addons,special_instructions,fee,status,payment_status,public_tracking_token,eta,arrival_time,claimed_at,voided_at,paid_at,updated_at,created_at,void_reason";
const TRANSACTION_SELECT_NO_PAID_AT =
  "id,ticket_id,customer_name,phone_number,wash_type,weight_kg,addons,special_instructions,fee,status,payment_status,public_tracking_token,eta,arrival_time,claimed_at,voided_at,updated_at,created_at,void_reason";
const TRANSACTION_SELECT_NO_VOIDED_AT =
  "id,ticket_id,customer_name,phone_number,wash_type,weight_kg,addons,special_instructions,fee,status,payment_status,public_tracking_token,eta,arrival_time,claimed_at,paid_at,updated_at,created_at,void_reason";
const TRANSACTION_SELECT_NO_VOIDED_AT_NO_PAID_AT =
  "id,ticket_id,customer_name,phone_number,wash_type,weight_kg,addons,special_instructions,fee,status,payment_status,public_tracking_token,eta,arrival_time,claimed_at,updated_at,created_at,void_reason";

let hasVoidedAtColumn = true;
let hasPaidAtColumn = true;

function isMissingVoidedAtError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("voided_at") || message.includes("42703") || message.includes("PGRST204");
}

function isMissingPaidAtError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("paid_at") || message.includes("42703") || message.includes("PGRST204");
}

function getTransactionSelect(): string {
  if (!hasPaidAtColumn && !hasVoidedAtColumn) return TRANSACTION_SELECT_NO_VOIDED_AT_NO_PAID_AT;
  if (!hasPaidAtColumn) return TRANSACTION_SELECT_NO_PAID_AT;
  if (!hasVoidedAtColumn) return TRANSACTION_SELECT_NO_VOIDED_AT;
  return TRANSACTION_SELECT;
}

const TRANSACTION_LIST_CACHE_TTL_MS = 5_000;
const transactionListCache = createTtlCache<Transaction[]>();

const PH_OFFSET = "+08:00";
const DEFAULT_PUBLIC_SHOP_PROFILE: PublicShopProfile = {
  shopName: DEFAULT_BUSINESS_PROFILE.shopName,
  tagline: DEFAULT_BUSINESS_PROFILE.tagline,
  logoDataUrl: DEFAULT_BUSINESS_PROFILE.logoDataUrl,
  address: DEFAULT_BUSINESS_PROFILE.address,
  contactNumber: DEFAULT_BUSINESS_PROFILE.contactNumber,
  email: DEFAULT_BUSINESS_PROFILE.email,
  receiptFooter: DEFAULT_BUSINESS_PROFILE.receiptFooter,
  pickupInstructions: DEFAULT_BUSINESS_PROFILE.pickupInstructions,
};

let mockTransactions: TransactionRow[] = seedTransactions.map((transaction, index) => {
  const timestamp = normalizeLocalDateTime(transaction.arrivalDateTime)
    ?? normalizeLocalDateTime(`${transaction.dropOffDate} 12:00`)
    ?? new Date(Date.UTC(2026, 3, index + 1, 8, 0, 0)).toISOString();

  return {
    id: transaction.id,
    ticket_id: transaction.ticketId,
    customer_name: transaction.customerName,
    phone_number: transaction.phone || null,
    wash_type: transaction.washType,
    weight_kg: transaction.weight,
    addons: transaction.addOns,
    special_instructions: transaction.washInstructions ?? null,
    fee: transaction.fee,
    status: transaction.status,
    payment_status: transaction.paymentStatus,
    public_tracking_token: createTrackingToken(),
    eta: null,
    arrival_time: timestamp,
    claimed_at: transaction.claimedAt ? normalizeLocalDateTime(transaction.claimedAt) : null,
    voided_at: transaction.voidedAt ? normalizeLocalDateTime(transaction.voidedAt) : (transaction.status === "Voided" ? timestamp : null),
    paid_at: transaction.paidAt ? normalizeLocalDateTime(transaction.paidAt) : (transaction.paymentStatus === "paid" ? timestamp : null),
    updated_at: timestamp,
    created_at: timestamp,
    void_reason: transaction.status === "Voided" ? "Voided in mock data" : null,
  };
});

let mockBusinessProfile = { ...DEFAULT_BUSINESS_PROFILE };
let mockSettingsMap: Record<string, unknown> = {
  loyalty_settings: { enabled: true, washesPerReward: 7, rewardDescription: "Free wash" },
};

function isValidTransactionStatus(value: string): value is TransactionStatus {
  return ["Received", "Washing", "Drying", "Ready", "Claimed", "Voided"].includes(value);
}

function normalizeStatus(value: string | null | undefined): TransactionStatus {
  if (value === "Drying") return "Washing";
  return value && isValidTransactionStatus(value) ? value : "Received";
}

function normalizePaymentStatus(value: string | null | undefined): Transaction["paymentStatus"] {
  return value === "paid" ? "paid" : "unpaid";
}

function normalizeLocalDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [datePart, timePart] = value.split(/[ T]/);
    const timeWithSec = timePart.length === 5 ? `${timePart}:00` : timePart;
    return `${datePart}T${timeWithSec}${PH_OFFSET}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00${PH_OFFSET}`;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createTrackingToken(): string {
  return randomBytes(16).toString("hex");
}

function mapRowToTransaction(row: TransactionRow): Transaction {
  const arrivalTimestamp = row.arrival_time ?? row.created_at;
  const status = normalizeStatus(row.status);
  const claimedTimestamp = row.claimed_at;
  const voidedTimestamp = row.voided_at;
  const paidTimestamp = row.paid_at;

  const rawInstructions = row.special_instructions ?? undefined;
  const loadsMatch = rawInstructions?.match(/\[LOADS:(\d+)\]/);
  const loads = loadsMatch
    ? parseInt(loadsMatch[1], 10)
    : (!row.weight_kg || Number(row.weight_kg) === 0 ? 1 : undefined);

  const washInstructions = rawInstructions
    ? rawInstructions
        .replace(/\[OFFLINE_REF:[^\]]+\]/g, "")
        .replace(/\[LOADS:\d+\]/g, "")
        .trim() || undefined
    : undefined;

  return {
    id: row.id,
    ticketId: row.ticket_id,
    customerName: row.customer_name,
    phone: row.phone_number ?? "",
    arrivalDateTime: formatCompactDateTime(arrivalTimestamp),
    dropOffDate: formatCompactDate(arrivalTimestamp),
    claimedAt: claimedTimestamp ? formatCompactDateTime(claimedTimestamp) : undefined,
    voidedAt: voidedTimestamp ? formatCompactDateTime(voidedTimestamp) : undefined,
    paidAt: paidTimestamp ? formatCompactDateTime(paidTimestamp) : undefined,
    washType: row.wash_type,
    weight: Number(row.weight_kg ?? 0),
    loads,
    fee: Number(row.fee ?? 0),
    status,
    paymentStatus: normalizePaymentStatus(row.payment_status),
    addOns: row.addons ?? [],
    washInstructions,
    publicTrackingToken: row.public_tracking_token ?? undefined,
    updatedAt: row.updated_at ?? row.created_at ?? undefined,
    eta: row.eta ?? undefined,
    voidReason: row.void_reason ?? undefined,
  };
}

function mapProfileToPublic(profile: BusinessProfile): PublicShopProfile {
  return {
    shopName: profile.shopName,
    tagline: profile.tagline,
    logoDataUrl: profile.logoDataUrl,
    address: profile.address,
    contactNumber: profile.contactNumber,
    email: profile.email,
    receiptFooter: profile.receiptFooter,
    pickupInstructions: profile.pickupInstructions,
  };
}

function mapRowToPublicRecord(
  row: TransactionRow,
  profile: BusinessProfile,
  pricingConfig?: PricingConfig | null,
): PublicTrackingRecord {
  const transaction = mapRowToTransaction(row);
  const enablePaymentOption = pricingConfig?.enablePaymentOption ?? true;

  return {
    ticketId: transaction.ticketId,
    customerName: transaction.customerName,
    customerPhone: transaction.phone || undefined,
    status: transaction.status,
    eta: transaction.eta ?? null,
    updatedAt: transaction.updatedAt ?? null,
    paymentStatus: transaction.paymentStatus,
    paidAt: transaction.paidAt ?? null,
    balanceDue: transaction.paymentStatus === "paid" ? 0 : transaction.fee,
    totalAmount: transaction.fee,
    paidAmount: transaction.paymentStatus === "paid" ? transaction.fee : 0,
    weight: transaction.weight,
    loads: transaction.loads,
    washType: transaction.washType,
    addOns: transaction.addOns,
    washInstructions: transaction.washInstructions ?? null,
    dropOffTime: transaction.arrivalDateTime,
    claimedAt: transaction.claimedAt ?? null,
    shopProfile: mapProfileToPublic(profile),
    enablePaymentOption,
  };
}

function hasSupabaseConfig(): boolean {
  return Boolean(getPublicSupabaseConfig() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseConfig() {
  const publicConfig = getPublicSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!publicConfig || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables. Expected NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
    );
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

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

async function listSupabaseRows(): Promise<TransactionRow[]> {
  try {
    const query = `transactions?select=${getTransactionSelect()}&order=arrival_time.desc.nullslast,created_at.desc`;
    return await restRequest<TransactionRow[]>(query);
  } catch (error) {
    let retried = false;
    if (hasPaidAtColumn && isMissingPaidAtError(error)) {
      hasPaidAtColumn = false;
      retried = true;
    }
    if (hasVoidedAtColumn && isMissingVoidedAtError(error)) {
      hasVoidedAtColumn = false;
      retried = true;
    }
    if (retried) {
      const fallbackQuery = `transactions?select=${getTransactionSelect()}&order=arrival_time.desc.nullslast,created_at.desc`;
      return await restRequest<TransactionRow[]>(fallbackQuery);
    }
    throw error;
  }
}

async function getSupabaseTransactionByTicket(ticketId: string): Promise<TransactionRow | null> {
  try {
    const query = `transactions?select=${getTransactionSelect()}&ticket_id=eq.${encodeURIComponent(ticketId)}&limit=1`;
    const rows = await restRequest<TransactionRow[]>(query);
    if (rows[0]) return rows[0];
    if (ticketId.startsWith("OFF-")) {
      const offlineQuery = `transactions?select=${getTransactionSelect()}&special_instructions=like.*[OFFLINE_REF:${encodeURIComponent(ticketId)}]*&limit=1`;
      const offlineRows = await restRequest<TransactionRow[]>(offlineQuery).catch(() => []);
      if (offlineRows[0]) return offlineRows[0];
    }
    return null;
  } catch (error) {
    let retried = false;
    if (hasPaidAtColumn && isMissingPaidAtError(error)) {
      hasPaidAtColumn = false;
      retried = true;
    }
    if (hasVoidedAtColumn && isMissingVoidedAtError(error)) {
      hasVoidedAtColumn = false;
      retried = true;
    }
    if (retried) {
      const fallbackQuery = `transactions?select=${getTransactionSelect()}&ticket_id=eq.${encodeURIComponent(ticketId)}&limit=1`;
      const rows = await restRequest<TransactionRow[]>(fallbackQuery);
      if (rows[0]) return rows[0];
      if (ticketId.startsWith("OFF-")) {
        const offlineFallbackQuery = `transactions?select=${getTransactionSelect()}&special_instructions=like.*[OFFLINE_REF:${encodeURIComponent(ticketId)}]*&limit=1`;
        const offlineRows = await restRequest<TransactionRow[]>(offlineFallbackQuery).catch(() => []);
        if (offlineRows[0]) return offlineRows[0];
      }
      return null;
    }
    throw error;
  }
}

async function getSupabaseTransactionByToken(token: string): Promise<TransactionRow | null> {
  try {
    const query = `transactions?select=${getTransactionSelect()}&public_tracking_token=eq.${encodeURIComponent(token)}&limit=1`;
    const rows = await restRequest<TransactionRow[]>(query);
    return rows[0] ?? null;
  } catch (error) {
    let retried = false;
    if (hasPaidAtColumn && isMissingPaidAtError(error)) {
      hasPaidAtColumn = false;
      retried = true;
    }
    if (hasVoidedAtColumn && isMissingVoidedAtError(error)) {
      hasVoidedAtColumn = false;
      retried = true;
    }
    if (retried) {
      const fallbackQuery = `transactions?select=${getTransactionSelect()}&public_tracking_token=eq.${encodeURIComponent(token)}&limit=1`;
      const rows = await restRequest<TransactionRow[]>(fallbackQuery);
      return rows[0] ?? null;
    }
    throw error;
  }
}

async function getNextSupabaseTicketId(): Promise<string> {
  const rows = await restRequest<Array<Pick<TransactionRow, "ticket_id">>>(
    "transactions?select=ticket_id&order=ticket_id.desc&limit=1",
  );
  const lastNumber = rows[0]?.ticket_id ? Number.parseInt(rows[0].ticket_id.replace(/^TKT-/, ""), 10) : 0;
  return `TKT-${String((Number.isNaN(lastNumber) ? 0 : lastNumber) + 1).padStart(4, "0")}`;
}

async function createSupabaseTransaction(input: CreateTransactionInput): Promise<TransactionRow> {
  const instructions = [
    input.washInstructions?.trim() || null,
    input.offlineTicketId ? `[OFFLINE_REF:${input.offlineTicketId.trim()}]` : null,
    input.loads && input.loads > 0 ? `[LOADS:${input.loads}]` : null,
  ].filter(Boolean).join(" ") || null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ticketId = await getNextSupabaseTicketId();
    const now = new Date().toISOString();
    const isPaid = input.paymentStatus === "paid";
    const payload: Record<string, unknown> = {
      ticket_id: ticketId,
      customer_name: input.customerName.trim(),
      phone_number: input.phone?.trim() || null,
      wash_type: input.washType,
      weight_kg: input.weight || null,
      addons: input.addOns ?? [],
      special_instructions: instructions,
      fee: input.fee,
      status: input.status ?? "Received",
      payment_status: input.paymentStatus ?? "unpaid",
      public_tracking_token: createTrackingToken(),
      eta: normalizeLocalDateTime(input.eta ?? null),
      arrival_time: normalizeLocalDateTime(input.arrivalDateTime) ?? now,
    };
    if (hasPaidAtColumn) {
      payload.paid_at = isPaid ? now : null;
    }

    try {
      const rows = await restRequest<TransactionRow[]>("transactions", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });
      return rows[0];
    } catch (error) {
      if (hasPaidAtColumn && isMissingPaidAtError(error)) {
        hasPaidAtColumn = false;
        delete payload.paid_at;
        const rows = await restRequest<TransactionRow[]>("transactions", {
          method: "POST",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        });
        return rows[0];
      }
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("duplicate key")) {
        throw error;
      }
    }
  }

  throw new Error("Unable to allocate a unique ticket ID after multiple attempts.");
}

async function updateSupabaseTransaction(ticketId: string, updates: UpdateTransactionInput): Promise<TransactionRow> {
  const existing = await getSupabaseTransactionByTicket(ticketId);
  if (!existing) {
    throw new Error(`Transaction ${ticketId} was not found.`);
  }

  const effectivePayment = updates.paymentStatus ?? existing.payment_status;
  if (updates.status === "Claimed" && effectivePayment !== "paid") {
    throw new Error("Cannot mark transaction as Claimed while payment is unpaid.");
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status) {
    payload.status = updates.status;
    if (updates.status === "Claimed" && !existing.claimed_at) {
      payload.claimed_at = new Date().toISOString();
    } else if (updates.status !== "Claimed" && existing.status === "Claimed") {
      payload.claimed_at = null;
    }
    if (hasVoidedAtColumn && updates.status === "Voided" && !existing.voided_at) {
      payload.voided_at = new Date().toISOString();
    } else if (hasVoidedAtColumn && updates.status !== "Voided" && existing.status === "Voided") {
      payload.voided_at = null;
      payload.void_reason = null;
    }
  }
  if (updates.paymentStatus) {
    payload.payment_status = updates.paymentStatus;
    if (hasPaidAtColumn && updates.paymentStatus === "paid" && !existing.paid_at) {
      payload.paid_at = new Date().toISOString();
    }
  }
  if (updates.washInstructions !== undefined) payload.special_instructions = updates.washInstructions?.trim() || null;
  if (updates.eta !== undefined) payload.eta = normalizeLocalDateTime(updates.eta ?? null);
  if (updates.voidReason !== undefined) payload.void_reason = updates.voidReason?.trim() || null;

  const query = `transactions?ticket_id=eq.${encodeURIComponent(existing.ticket_id)}&select=${getTransactionSelect()}`;
  try {
    const rows = await restRequest<TransactionRow[]>(query, {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!rows[0]) {
      throw new Error(`Transaction ${ticketId} was not found.`);
    }

    return rows[0];
  } catch (error) {
    if (hasPaidAtColumn && isMissingPaidAtError(error)) {
      hasPaidAtColumn = false;
      delete payload.paid_at;
      const fallbackQuery = `transactions?ticket_id=eq.${encodeURIComponent(existing.ticket_id)}&select=${getTransactionSelect()}`;
      const rows = await restRequest<TransactionRow[]>(fallbackQuery, {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });

      if (!rows[0]) {
        throw new Error(`Transaction ${ticketId} was not found.`);
      }

      return rows[0];
    }
    if (hasVoidedAtColumn && isMissingVoidedAtError(error)) {
      hasVoidedAtColumn = false;
      delete payload.voided_at;
      const fallbackQuery = `transactions?ticket_id=eq.${encodeURIComponent(existing.ticket_id)}&select=${TRANSACTION_SELECT_NO_VOIDED_AT}`;
      const rows = await restRequest<TransactionRow[]>(fallbackQuery, {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });

      if (!rows[0]) {
        throw new Error(`Transaction ${ticketId} was not found.`);
      }

      return rows[0];
    }
    throw error;
  }
}

async function deleteSupabaseTransaction(ticketId: string): Promise<boolean> {
  const existing = await getSupabaseTransactionByTicket(ticketId);
  if (!existing) {
    return false;
  }
  await restRequest(`transactions?ticket_id=eq.${encodeURIComponent(existing.ticket_id)}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=representation",
    },
  });
  return true;
}

async function getSupabaseSettings<T>(key: string, fallback: T): Promise<T> {
  const rows = await restRequest<Array<SettingsRow<T>>>(
    `settings?key=eq.${encodeURIComponent(key)}&select=key,value&limit=1`,
  );
  return rows[0]?.value ?? fallback;
}

async function saveSupabaseSettings<T>(key: string, value: T): Promise<T> {
  const updatedRows = await restRequest<Array<SettingsRow<T>>>(
    `settings?key=eq.${encodeURIComponent(key)}&select=key,value`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({ value }),
    },
  );

  if (updatedRows[0]?.value !== undefined) {
    return updatedRows[0].value;
  }

  const insertedRows = await restRequest<Array<SettingsRow<T>>>(
    "settings?on_conflict=key&select=key,value",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([
        {
          key,
          value,
        },
      ]),
    },
  );

  return insertedRows[0]?.value ?? value;
}

async function getSupabaseBusinessProfile(): Promise<BusinessProfile> {
  return getSupabaseSettings<BusinessProfile>("business_profile", DEFAULT_BUSINESS_PROFILE);
}

async function saveSupabaseBusinessProfile(profile: BusinessProfile): Promise<BusinessProfile> {
  const normalized = normalizeBusinessProfile(profile);
  await saveSupabaseSettings("business_profile", normalized);
  return normalized;
}

function listMockRows(): TransactionRow[] {
  return [...mockTransactions].sort((a, b) => (b.arrival_time ?? "").localeCompare(a.arrival_time ?? ""));
}

function getMockTransactionByTicket(ticketId: string): TransactionRow | null {
  return (
    mockTransactions.find(
      (transaction) =>
        transaction.ticket_id === ticketId ||
        (ticketId.startsWith("OFF-") &&
          transaction.special_instructions?.includes(`[OFFLINE_REF:${ticketId}]`))
    ) ?? null
  );
}

function getMockTransactionByToken(token: string): TransactionRow | null {
  return mockTransactions.find((transaction) => transaction.public_tracking_token === token) ?? null;
}

function getNextMockTicketId(): string {
  const maxTicket = mockTransactions.reduce((current, transaction) => {
    const value = Number.parseInt(transaction.ticket_id.replace(/^TKT-/, ""), 10);
    return Number.isNaN(value) ? current : Math.max(current, value);
  }, 0);

  return `TKT-${String(maxTicket + 1).padStart(4, "0")}`;
}

function createMockTransaction(input: CreateTransactionInput): TransactionRow {
  const now = new Date().toISOString();
  const isPaid = input.paymentStatus === "paid";
  const instructions = [
    input.washInstructions?.trim() || null,
    input.offlineTicketId ? `[OFFLINE_REF:${input.offlineTicketId.trim()}]` : null,
    input.loads && input.loads > 0 ? `[LOADS:${input.loads}]` : null,
  ].filter(Boolean).join(" ") || null;

  const row: TransactionRow = {
    id: randomUUID(),
    ticket_id: getNextMockTicketId(),
    customer_name: input.customerName.trim(),
    phone_number: input.phone?.trim() || null,
    wash_type: input.washType,
    weight_kg: input.weight || null,
    addons: input.addOns ?? [],
    special_instructions: instructions,
    fee: input.fee,
    status: input.status ?? "Received",
    payment_status: input.paymentStatus ?? "unpaid",
    public_tracking_token: createTrackingToken(),
    eta: normalizeLocalDateTime(input.eta ?? null),
    arrival_time: normalizeLocalDateTime(input.arrivalDateTime) ?? now,
    claimed_at: null,
    voided_at: null,
    paid_at: isPaid ? now : null,
    updated_at: now,
    created_at: now,
    void_reason: null,
  };

  mockTransactions = [row, ...mockTransactions];
  return row;
}

function deleteMockTransaction(ticketId: string): boolean {
  const existing = getMockTransactionByTicket(ticketId);
  if (!existing) {
    return false;
  }
  const index = mockTransactions.findIndex((t) => t.ticket_id === existing.ticket_id);
  if (index === -1) {
    return false;
  }
  mockTransactions.splice(index, 1);
  return true;
}

function updateMockTransaction(ticketId: string, updates: UpdateTransactionInput): TransactionRow {
  const existing = getMockTransactionByTicket(ticketId);
  if (!existing) {
    throw new Error(`Transaction ${ticketId} was not found.`);
  }

  const effectivePayment = updates.paymentStatus ?? existing.payment_status;
  if (updates.status === "Claimed" && effectivePayment !== "paid") {
    throw new Error("Cannot mark transaction as Claimed while payment is unpaid.");
  }

  const now = new Date().toISOString();
  let claimed_at = existing.claimed_at;
  let voided_at = existing.voided_at;
  let paid_at = existing.paid_at;

  if (updates.status === "Claimed" && !claimed_at) {
    claimed_at = now;
  } else if (updates.status && updates.status !== "Claimed" && existing.status === "Claimed") {
    claimed_at = null;
  }
  if (updates.status === "Voided" && !voided_at) {
    voided_at = now;
  } else if (updates.status && updates.status !== "Voided" && existing.status === "Voided") {
    voided_at = null;
  }
  if (updates.paymentStatus === "paid" && !paid_at) {
    paid_at = now;
  }

  const updated: TransactionRow = {
    ...existing,
    status: updates.status ?? existing.status,
    payment_status: updates.paymentStatus ?? existing.payment_status,
    special_instructions:
      updates.washInstructions !== undefined
        ? updates.washInstructions?.trim() || null
        : existing.special_instructions,
    eta: updates.eta !== undefined ? normalizeLocalDateTime(updates.eta ?? null) : existing.eta,
    void_reason:
      updates.status && updates.status !== "Voided" && existing.status === "Voided"
        ? null
        : updates.voidReason !== undefined
        ? updates.voidReason?.trim() || null
        : existing.void_reason,
    claimed_at,
    voided_at,
    paid_at,
    updated_at: now,
  };

  mockTransactions = mockTransactions.map((transaction) =>
    transaction.ticket_id === ticketId ? updated : transaction,
  );

  return updated;
}

function getMockBusinessProfile(): BusinessProfile {
  return { ...mockBusinessProfile };
}

function saveMockBusinessProfile(profile: BusinessProfile): BusinessProfile {
  mockBusinessProfile = normalizeBusinessProfile(profile);
  return { ...mockBusinessProfile };
}

function extractTicketId(value: string): string | null {
  const directTicket = value.trim().match(/^TKT-[A-Z0-9-]+$/i);
  if (directTicket) return directTicket[0].toUpperCase();

  const urlTicket = value.match(/\/ticket\/([A-Z0-9-]+)/i);
  return urlTicket ? urlTicket[1].toUpperCase() : null;
}

function extractTrackingToken(value: string): string | null {
  const urlToken = value.match(/\/track\/([a-z0-9]+)/i);
  if (urlToken) return urlToken[1].toLowerCase();

  const directToken = value.trim().match(/^[a-f0-9]{16,64}$/i);
  return directToken ? directToken[0].toLowerCase() : null;
}

export function isSupabaseConfigured(): boolean {
  return hasSupabaseConfig();
}

export async function listTransactions(): Promise<Transaction[]> {
  const cachedRows = transactionListCache.get("transactions");
  if (cachedRows) {
    return cachedRows;
  }

  const rows = hasSupabaseConfig() ? await listSupabaseRows() : listMockRows();
  const transactions = rows.map(mapRowToTransaction);
  transactionListCache.set("transactions", transactions, TRANSACTION_LIST_CACHE_TTL_MS);
  return transactions;
}

export async function getTransactionByTicketId(ticketId: string): Promise<Transaction | null> {
  const row = hasSupabaseConfig()
    ? await getSupabaseTransactionByTicket(ticketId)
    : getMockTransactionByTicket(ticketId);

  return row ? mapRowToTransaction(row) : null;
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const row = hasSupabaseConfig() ? await createSupabaseTransaction(input) : createMockTransaction(input);
  transactionListCache.delete("transactions");
  return mapRowToTransaction(row);
}

export async function updateTransaction(ticketId: string, updates: UpdateTransactionInput): Promise<Transaction> {
  const row = hasSupabaseConfig()
    ? await updateSupabaseTransaction(ticketId, updates)
    : updateMockTransaction(ticketId, updates);

  transactionListCache.delete("transactions");
  return mapRowToTransaction(row);
}

export async function deleteTransaction(ticketId: string): Promise<boolean> {
  const deleted = hasSupabaseConfig()
    ? await deleteSupabaseTransaction(ticketId)
    : deleteMockTransaction(ticketId);

  transactionListCache.delete("transactions");
  return deleted;
}

export async function resolveScannedTransaction(value: string): Promise<Transaction | null> {
  const ticketId = extractTicketId(value);
  if (ticketId) {
    const row = hasSupabaseConfig()
      ? await getSupabaseTransactionByTicket(ticketId)
      : getMockTransactionByTicket(ticketId);
    return row ? mapRowToTransaction(row) : null;
  }

  const token = extractTrackingToken(value);
  if (!token) return null;

  const row = hasSupabaseConfig()
    ? await getSupabaseTransactionByToken(token)
    : getMockTransactionByToken(token);

  return row ? mapRowToTransaction(row) : null;
}

export async function getPublicTrackingRecord(token: string): Promise<PublicTrackingRecord | null> {
  const cleanTicket = extractTicketId(token);
  const cleanToken = extractTrackingToken(token);
  if (!cleanToken && !cleanTicket) return null;

  const [row, profile, pricingConfig] = await Promise.all([
    hasSupabaseConfig()
      ? (cleanToken ? getSupabaseTransactionByToken(cleanToken) : (cleanTicket ? getSupabaseTransactionByTicket(cleanTicket) : null))
      : Promise.resolve(cleanToken ? getMockTransactionByToken(cleanToken) : (cleanTicket ? getMockTransactionByTicket(cleanTicket) : null)),
    getBusinessProfile(),
    getSettings<PricingConfig>("pricing_config").catch(() => null),
  ]);

  if (!row) return null;
  return mapRowToPublicRecord(row, profile, pricingConfig);
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  return hasSupabaseConfig() ? getSupabaseBusinessProfile() : getMockBusinessProfile();
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<BusinessProfile> {
  return hasSupabaseConfig()
    ? saveSupabaseBusinessProfile(profile)
    : saveMockBusinessProfile(profile);
}

export function getDefaultPublicShopProfile(): PublicShopProfile {
  return DEFAULT_PUBLIC_SHOP_PROFILE;
}

export async function getSettings<T>(key: string, fallback?: T): Promise<T | null> {
  if (hasSupabaseConfig()) {
    try {
      return await getSupabaseSettings<T>(key, fallback ?? (null as T));
    } catch {
      // fallback to mockSettingsMap if Supabase request fails
    }
  }
  if (key in mockSettingsMap) {
    return mockSettingsMap[key] as T;
  }
  return fallback ?? (null as T);
}

export async function saveSettings<T>(key: string, value: T): Promise<T> {
  mockSettingsMap[key] = value;
  if (hasSupabaseConfig()) {
    try {
      return await saveSupabaseSettings<T>(key, value);
    } catch {
      return value;
    }
  }
  return value;
}
