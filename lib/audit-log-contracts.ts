import type { PaymentStatus } from "@/lib/data";

export type AuditActionType =
  | "all"
  | "transaction_created"
  | "transaction_updated"
  | "transaction_voided"
  | "status_changed"
  | "claim_scanned"
  | "claim_verified"
  | "claim_denied"
  | "loyalty_stamp"
  | "reward_redeemed"
  | "settings_changed"
  | "staff_created"
  | "staff_updated"
  | "staff_deactivated"
  | "staff_reactivated"
  | "staff_password_reset"
  | "login"
  | "logout"
  | "report_exported"
  | "other";

export type AuditStaffRole = "Admin" | "Staff" | "System";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  staffName: string;
  staffRole: AuditStaffRole;
  action: AuditActionType;
  summary: string;
  details: string;
  ticketId?: string;
  customerName?: string;
  paymentStatus?: PaymentStatus;
  ipAddress?: string;
  clientCorrelationId?: string;
  isPending?: boolean;
  isUnsaved?: boolean;
}

export interface CreateAuditLogInput {
  action: Exclude<AuditActionType, "all"> | string;
  summary: string;
  details?: string;
  ticketId?: string | null;
  transactionId?: string | null;
  customerName?: string | null;
  paymentStatus?: PaymentStatus | null;
  staffProfileId?: string | null;
  staffName?: string | null;
  staffRole?: "admin" | "staff" | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}
