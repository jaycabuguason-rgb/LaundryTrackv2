import "server-only";

import type {
  AuditActionType,
  AuditLogEntry,
  AuditStaffRole,
  CreateAuditLogInput,
} from "@/lib/audit-log-contracts";
import type { PaymentStatus } from "@/lib/data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createTtlCache } from "@/lib/server/ttl-cache";

type AuditLogRow = {
  id: string;
  created_at: string | null;
  action: string | null;
  summary: string | null;
  notes: string | null;
  ticket_id: string | null;
  customer_name: string | null;
  payment_status: PaymentStatus | null;
  staff_name: string | null;
  staff_role: string | null;
  ip_address: string | null;
};

const AUDIT_LOG_CACHE_TTL_MS = 10_000;
const auditLogCache = createTtlCache<AuditLogEntry[]>();

const KNOWN_ACTIONS = new Set<AuditActionType>([
  "transaction_created",
  "transaction_updated",
  "status_changed",
  "claim_verified",
  "loyalty_stamp",
  "reward_redeemed",
  "settings_changed",
  "staff_created",
  "staff_updated",
  "staff_deactivated",
  "staff_reactivated",
  "staff_password_reset",
  "login",
  "logout",
  "report_exported",
  "other",
]);

const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
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
  {
    id: "AL-004",
    timestamp: "2026-04-15T10:00:00",
    staffName: "Admin",
    staffRole: "Admin",
    action: "staff_created",
    summary: "Created staff account: maria_santos",
    details: "Full Name: Maria Santos | Username: maria_santos | Role: Staff | Status: Active",
    ipAddress: "192.168.1.1",
  },
];

function mapAction(value: string | null): AuditActionType {
  if (value && KNOWN_ACTIONS.has(value as AuditActionType)) {
    return value as AuditActionType;
  }
  return "other";
}

function mapStaffRole(value: string | null): AuditStaffRole {
  if (value === "admin") {
    return "Admin";
  }
  if (value === "staff") {
    return "Staff";
  }
  return "System";
}

function mapAuditRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.created_at ?? new Date().toISOString(),
    staffName: row.staff_name || "System",
    staffRole: mapStaffRole(row.staff_role),
    action: mapAction(row.action),
    summary: row.summary || row.action || "Audit event",
    details: row.notes || "No additional details.",
    ticketId: row.ticket_id ?? undefined,
    customerName: row.customer_name ?? undefined,
    paymentStatus: row.payment_status ?? undefined,
    ipAddress: row.ip_address ?? undefined,
  };
}

export async function listAuditLogs(limit = 200): Promise<AuditLogEntry[]> {
  const cacheKey = `audit-logs:${limit}`;
  const cachedLogs = auditLogCache.get(cacheKey);
  if (cachedLogs) {
    return cachedLogs;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,created_at,action,summary,notes,ticket_id,customer_name,payment_status,staff_name,staff_role,ip_address")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const auditLogs = (data as AuditLogRow[]).map(mapAuditRow);
  auditLogCache.set(cacheKey, auditLogs, AUDIT_LOG_CACHE_TTL_MS);
  return auditLogs;
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    transaction_id: input.transactionId ?? null,
    ticket_id: input.ticketId ?? null,
    action: input.action,
    staff_name: input.staffName ?? null,
    staff_role: input.staffRole ?? null,
    staff_profile_id: input.staffProfileId ?? null,
    summary: input.summary,
    customer_name: input.customerName ?? null,
    payment_status: input.paymentStatus ?? null,
    ip_address: input.ipAddress ?? null,
    notes: input.details ?? "",
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }

  auditLogCache.clear();
}

export function listMockAuditLogs(): AuditLogEntry[] {
  return MOCK_AUDIT_LOGS;
}
