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
  updated_at: string | null;
  created_at: string | null;
  void_reason: string | null;
};

type SettingsRow<T = unknown> = {
  key: string;
  value: T;
};

const TRANSACTION_SELECT =
  "id,ticket_id,customer_name,phone_number,wash_type,weight_kg,addons,special_instructions,fee,status,payment_status,public_tracking_token,eta,arrival_time,updated_at,created_at,void_reason";
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
    updated_at: timestamp,
    created_at: timestamp,
    void_reason: transaction.status === "Voided" ? "Voided in mock data" : null,
  };
});

let mockBusinessProfile = { ...DEFAULT_BUSINESS_PROFILE };

function isValidTransactionStatus(value: string): value is TransactionStatus {
  return ["Received", "Washing", "Drying", "Processing", "Ready", "Claimed", "Voided"].includes(value);
}

function normalizeStatus(value: string | null | undefined): TransactionStatus {
  return value && isValidTransactionStatus(value) ? value : "Received";
}

function normalizePaymentStatus(value: string | null | undefined): Transaction["paymentStatus"] {
  return value === "paid" ? "paid" : "unpaid";
}

function normalizeLocalDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) {
    return value.replace(" ", "T") + `:00${PH_OFFSET}`;
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

  return {
    id: row.id,
    ticketId: row.ticket_id,
    customerName: row.customer_name,
    phone: row.phone_number ?? "",
    arrivalDateTime: formatCompactDateTime(arrivalTimestamp),
    dropOffDate: formatCompactDate(arrivalTimestamp),
    washType: row.wash_type,
    weight: Number(row.weight_kg ?? 0),
    fee: Number(row.fee ?? 0),
    status: normalizeStatus(row.status),
    paymentStatus: normalizePaymentStatus(row.payment_status),
    addOns: row.addons ?? [],
    washInstructions: row.special_instructions ?? undefined,
    publicTrackingToken: row.public_tracking_token ?? undefined,
    updatedAt: row.updated_at ?? row.created_at ?? undefined,
    eta: row.eta ?? undefined,
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

function mapRowToPublicRecord(row: TransactionRow, profile: BusinessProfile): PublicTrackingRecord {
  const transaction = mapRowToTransaction(row);

  return {
    ticketId: transaction.ticketId,
    status: transaction.status,
    eta: transaction.eta ?? null,
    updatedAt: transaction.updatedAt ?? null,
    paymentStatus: transaction.paymentStatus,
    balanceDue: transaction.paymentStatus === "paid" ? 0 : transaction.fee,
    weight: transaction.weight,
    washType: transaction.washType,
    addOns: transaction.addOns,
    washInstructions: transaction.washInstructions ?? null,
    dropOffTime: transaction.arrivalDateTime,
    shopProfile: mapProfileToPublic(profile),
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
  const query = `transactions?select=${TRANSACTION_SELECT}&order=arrival_time.desc.nullslast,created_at.desc`;
  return restRequest<TransactionRow[]>(query);
}

async function getSupabaseTransactionByTicket(ticketId: string): Promise<TransactionRow | null> {
  const query = `transactions?select=${TRANSACTION_SELECT}&ticket_id=eq.${encodeURIComponent(ticketId)}&limit=1`;
  const rows = await restRequest<TransactionRow[]>(query);
  return rows[0] ?? null;
}

async function getSupabaseTransactionByToken(token: string): Promise<TransactionRow | null> {
  const query = `transactions?select=${TRANSACTION_SELECT}&public_tracking_token=eq.${encodeURIComponent(token)}&limit=1`;
  const rows = await restRequest<TransactionRow[]>(query);
  return rows[0] ?? null;
}

async function getNextSupabaseTicketId(): Promise<string> {
  const rows = await restRequest<Array<Pick<TransactionRow, "ticket_id">>>(
    "transactions?select=ticket_id&order=ticket_id.desc&limit=1",
  );
  const lastNumber = rows[0]?.ticket_id ? Number.parseInt(rows[0].ticket_id.replace(/^TKT-/, ""), 10) : 0;
  return `TKT-${String((Number.isNaN(lastNumber) ? 0 : lastNumber) + 1).padStart(4, "0")}`;
}

async function createSupabaseTransaction(input: CreateTransactionInput): Promise<TransactionRow> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ticketId = await getNextSupabaseTicketId();
    const payload = {
      ticket_id: ticketId,
      customer_name: input.customerName.trim(),
      phone_number: input.phone?.trim() || null,
      wash_type: input.washType,
      weight_kg: input.weight || null,
      addons: input.addOns ?? [],
      special_instructions: input.washInstructions?.trim() || null,
      fee: input.fee,
      status: input.status ?? "Received",
      payment_status: input.paymentStatus ?? "unpaid",
      public_tracking_token: createTrackingToken(),
      eta: normalizeLocalDateTime(input.eta ?? null),
      arrival_time: normalizeLocalDateTime(input.arrivalDateTime) ?? new Date().toISOString(),
    };

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
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("duplicate key")) {
        throw error;
      }
    }
  }

  throw new Error("Unable to allocate a unique ticket ID after multiple attempts.");
}

async function updateSupabaseTransaction(ticketId: string, updates: UpdateTransactionInput): Promise<TransactionRow> {
  const payload: Record<string, unknown> = {};

  if (updates.status) payload.status = updates.status;
  if (updates.paymentStatus) payload.payment_status = updates.paymentStatus;
  if (updates.washInstructions !== undefined) payload.special_instructions = updates.washInstructions?.trim() || null;
  if (updates.eta !== undefined) payload.eta = normalizeLocalDateTime(updates.eta ?? null);
  if (updates.voidReason !== undefined) payload.void_reason = updates.voidReason?.trim() || null;

  const query = `transactions?ticket_id=eq.${encodeURIComponent(ticketId)}&select=${TRANSACTION_SELECT}`;
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
  return mockTransactions.find((transaction) => transaction.ticket_id === ticketId) ?? null;
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
  const row: TransactionRow = {
    id: randomUUID(),
    ticket_id: getNextMockTicketId(),
    customer_name: input.customerName.trim(),
    phone_number: input.phone?.trim() || null,
    wash_type: input.washType,
    weight_kg: input.weight || null,
    addons: input.addOns ?? [],
    special_instructions: input.washInstructions?.trim() || null,
    fee: input.fee,
    status: input.status ?? "Received",
    payment_status: input.paymentStatus ?? "unpaid",
    public_tracking_token: createTrackingToken(),
    eta: normalizeLocalDateTime(input.eta ?? null),
    arrival_time: normalizeLocalDateTime(input.arrivalDateTime) ?? now,
    updated_at: now,
    created_at: now,
    void_reason: null,
  };

  mockTransactions = [row, ...mockTransactions];
  return row;
}

function updateMockTransaction(ticketId: string, updates: UpdateTransactionInput): TransactionRow {
  const existing = getMockTransactionByTicket(ticketId);
  if (!existing) {
    throw new Error(`Transaction ${ticketId} was not found.`);
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
    void_reason: updates.voidReason !== undefined ? updates.voidReason?.trim() || null : existing.void_reason,
    updated_at: new Date().toISOString(),
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
  const cleanToken = extractTrackingToken(token);
  if (!cleanToken) return null;

  const [row, profile] = await Promise.all([
    hasSupabaseConfig()
      ? getSupabaseTransactionByToken(cleanToken)
      : Promise.resolve(getMockTransactionByToken(cleanToken)),
    getBusinessProfile(),
  ]);

  if (!row) return null;
  return mapRowToPublicRecord(row, profile);
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
    return getSupabaseSettings<T>(key, fallback ?? null as T);
  }
  return fallback ?? null as T;
}

export async function saveSettings<T>(key: string, value: T): Promise<T> {
  if (hasSupabaseConfig()) {
    return saveSupabaseSettings<T>(key, value);
  }
  return value;
}
