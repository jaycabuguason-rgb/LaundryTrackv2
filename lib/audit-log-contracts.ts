import type { PaymentStatus } from "@/lib/data";

export type AuditActionType =
  | "all"
  | "transaction_created"
  | "transaction_updated"
  | "status_changed"
  | "claim_verified"
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
