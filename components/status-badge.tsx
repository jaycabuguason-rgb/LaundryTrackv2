"use client";

import {
  Ban,
  CircleCheck,
  CircleX,
  Inbox,
  PackageCheck,
  RotateCw,
  Wind,
  type LucideIcon,
} from "lucide-react";

import { statusColors, type PaymentStatus, type TransactionStatus } from "@/lib/data";
import { cn } from "@/lib/utils";

/** Canonical status → icon mapping shared across the entire app */
export const STATUS_ICONS: Record<TransactionStatus, LucideIcon> = {
  Received: Inbox,
  Washing: RotateCw,
  Drying: Wind,
  Ready: CircleCheck,
  Claimed: PackageCheck,
  Voided: Ban,
};

export function getStatusIcon(rawStatus: TransactionStatus | string, className = "w-4 h-4") {
  const status: TransactionStatus = rawStatus === "Drying" ? "Washing" : (rawStatus as TransactionStatus);
  const Icon = STATUS_ICONS[status] ?? Inbox;
  return <Icon className={className} aria-hidden="true" />;
}

/** Icon pill for transaction status — icon + label, never color-only */
export function StatusBadge({
  status: rawStatus,
  className,
  iconClassName = "w-3 h-3",
}: {
  status: TransactionStatus | string;
  className?: string;
  iconClassName?: string;
}) {
  const status: TransactionStatus = rawStatus === "Drying" ? "Washing" : (rawStatus as TransactionStatus);
  const Icon = STATUS_ICONS[status] ?? Inbox;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        statusColors[status],
        className,
      )}
    >
      <Icon className={iconClassName} aria-hidden="true" />
      {status}
    </span>
  );
}

/** Icon pill for payment status — Paid (check) / Unpaid (x) */
export function PaymentBadge({
  paymentStatus,
  className,
  iconClassName = "w-3 h-3",
}: {
  paymentStatus: PaymentStatus | "paid" | "unpaid";
  className?: string;
  iconClassName?: string;
}) {
  const paid = paymentStatus === "paid";
  const Icon = paid ? CircleCheck : CircleX;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap",
        paid
          ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
          : "bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
        className,
      )}
    >
      <Icon className={iconClassName} aria-hidden="true" />
      {paid ? "Paid" : "Unpaid"}
    </span>
  );
}
