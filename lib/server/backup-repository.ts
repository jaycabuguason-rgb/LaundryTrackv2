import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// ── Backup schema version ────────────────────────────────────────────────────

const BACKUP_VERSION = "1.0";
const APP_NAME = "LaundryTrack";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BackupPayload {
  meta: {
    appName: string;
    version: string;
    exportedAt: string;
    exportedBy: string;
    tableRecordCounts: Record<string, number>;
  };
  data: {
    settings: Array<{ key: string; value: unknown }>;
    service_types: Array<Record<string, unknown>>;
    add_ons: Array<Record<string, unknown>>;
    loyalty_members: Array<Record<string, unknown>>;
    transactions: Array<Record<string, unknown>>;
  };
}

export interface RestoreResult {
  settingsRestored: number;
  serviceTypesRestored: number;
  addOnsRestored: number;
  membersRestored: number;
  transactionsRestored: number;
}

// ── Export ───────────────────────────────────────────────────────────────────

export async function exportDatabaseBackup(exportedBy: string): Promise<BackupPayload> {
  const supabase = getSupabaseAdminClient();

  const [settingsRes, serviceTypesRes, addOnsRes, membersRes, transactionsRes] = await Promise.all([
    supabase.from("settings").select("*"),
    supabase.from("service_types").select("*"),
    supabase.from("add_ons").select("*"),
    supabase.from("loyalty_members").select("*"),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }),
  ]);

  if (settingsRes.error) throw new Error(`Failed to export settings: ${settingsRes.error.message}`);
  if (serviceTypesRes.error) throw new Error(`Failed to export service types: ${serviceTypesRes.error.message}`);
  if (addOnsRes.error) throw new Error(`Failed to export add-ons: ${addOnsRes.error.message}`);
  if (membersRes.error) throw new Error(`Failed to export loyalty members: ${membersRes.error.message}`);
  if (transactionsRes.error) throw new Error(`Failed to export transactions: ${transactionsRes.error.message}`);

  const settings = (settingsRes.data ?? []) as Array<{ key: string; value: unknown }>;
  const serviceTypes = (serviceTypesRes.data ?? []) as Array<Record<string, unknown>>;
  const addOns = (addOnsRes.data ?? []) as Array<Record<string, unknown>>;
  const members = (membersRes.data ?? []) as Array<Record<string, unknown>>;
  const transactions = (transactionsRes.data ?? []) as Array<Record<string, unknown>>;

  return {
    meta: {
      appName: APP_NAME,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy,
      tableRecordCounts: {
        settings: settings.length,
        service_types: serviceTypes.length,
        add_ons: addOns.length,
        loyalty_members: members.length,
        transactions: transactions.length,
      },
    },
    data: {
      settings,
      service_types: serviceTypes,
      add_ons: addOns,
      loyalty_members: members,
      transactions,
    },
  };
}

// ── Validate ─────────────────────────────────────────────────────────────────

export function validateBackupPayload(payload: unknown): payload is BackupPayload {
  if (!payload || typeof payload !== "object") return false;
  const obj = payload as Record<string, unknown>;

  // Check meta
  if (!obj.meta || typeof obj.meta !== "object") return false;
  const meta = obj.meta as Record<string, unknown>;
  if (meta.appName !== APP_NAME) return false;
  if (typeof meta.version !== "string") return false;
  if (typeof meta.exportedAt !== "string") return false;

  // Check data
  if (!obj.data || typeof obj.data !== "object") return false;
  const data = obj.data as Record<string, unknown>;
  if (!Array.isArray(data.settings)) return false;
  if (!Array.isArray(data.transactions)) return false;
  if (!Array.isArray(data.loyalty_members)) return false;

  // service_types and add_ons are optional for older backups but expected
  if (data.service_types !== undefined && !Array.isArray(data.service_types)) return false;
  if (data.add_ons !== undefined && !Array.isArray(data.add_ons)) return false;

  return true;
}

// ── Restore ──────────────────────────────────────────────────────────────────

export async function restoreDatabaseBackup(payload: BackupPayload): Promise<RestoreResult> {
  const supabase = getSupabaseAdminClient();
  const result: RestoreResult = {
    settingsRestored: 0,
    serviceTypesRestored: 0,
    addOnsRestored: 0,
    membersRestored: 0,
    transactionsRestored: 0,
  };

  // 1. Restore settings (upsert by key)
  if (payload.data.settings.length > 0) {
    const { error } = await supabase
      .from("settings")
      .upsert(
        payload.data.settings.map((s) => ({ key: s.key, value: s.value })),
        { onConflict: "key" },
      );
    if (error) throw new Error(`Failed to restore settings: ${error.message}`);
    result.settingsRestored = payload.data.settings.length;
  }

  // 2. Restore service_types (upsert by id)
  const serviceTypes = payload.data.service_types ?? [];
  if (serviceTypes.length > 0) {
    const { error } = await supabase
      .from("service_types")
      .upsert(serviceTypes, { onConflict: "id" });
    if (error) throw new Error(`Failed to restore service types: ${error.message}`);
    result.serviceTypesRestored = serviceTypes.length;
  }

  // 3. Restore add_ons (upsert by id)
  const addOns = payload.data.add_ons ?? [];
  if (addOns.length > 0) {
    const { error } = await supabase
      .from("add_ons")
      .upsert(addOns, { onConflict: "id" });
    if (error) throw new Error(`Failed to restore add-ons: ${error.message}`);
    result.addOnsRestored = addOns.length;
  }

  // 4. Restore loyalty_members (upsert by id)
  if (payload.data.loyalty_members.length > 0) {
    const { error } = await supabase
      .from("loyalty_members")
      .upsert(payload.data.loyalty_members, { onConflict: "id" });
    if (error) throw new Error(`Failed to restore loyalty members: ${error.message}`);
    result.membersRestored = payload.data.loyalty_members.length;
  }

  // 5. Restore transactions (upsert by id) — last due to FK on member_id
  if (payload.data.transactions.length > 0) {
    // Process in batches of 100 to avoid payload size limits
    const BATCH_SIZE = 100;
    const txns = payload.data.transactions;
    for (let i = 0; i < txns.length; i += BATCH_SIZE) {
      const batch = txns.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("transactions")
        .upsert(batch, { onConflict: "id" });
      if (error) throw new Error(`Failed to restore transactions (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`);
    }
    result.transactionsRestored = txns.length;
  }

  return result;
}
