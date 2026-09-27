"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type Transaction, type TransactionStatus } from "@/lib/data";
import {
  CheckCircle2,
  Circle,
  Edit,
  Sparkles,
  X,
  Printer,
  QrCode,
  Store,
  ChevronDown,
  Check,
  RotateCw,
  Banknote,
  Receipt,
  FileText,
  Inbox,
  Clock,
  Undo2,
  Loader2,
} from "lucide-react";
import { useLoyaltyMembers } from "@/hooks/use-loyalty-members";
import { formatReadableDateTime } from "@/lib/date-format";
import { getQrCodeImageUrl, printQrTicketOnly } from "@/lib/qr-ticket";
import { loadBusinessProfile } from "@/lib/settings-store";
import { cn } from "@/lib/utils";

interface TransactionDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onEditStatus?: (ticketId: string) => void;
  loyaltyEnabled?: boolean;
  onAdvanceStage?: (txn: Transaction) => void;
  onReceivePayment?: (txn: Transaction) => void;
  onPrintReceipt?: (txn: Transaction) => void;
  onReprintQr?: (txn: Transaction) => void;
  onUndoClaim?: (txn: Transaction) => void;
  onUndoVoid?: (txn: Transaction) => void;
}

const STATUS_STEPS: TransactionStatus[] = ["Received", "Washing", "Ready", "Claimed"];

function getStepIndex(status: TransactionStatus): number {
  if (status === "Voided") return -1;
  if (status === "Drying") return 1;
  return STATUS_STEPS.indexOf(status);
}

export function TransactionDetailModal({
  open,
  onOpenChange,
  transaction,
  onEditStatus,
  loyaltyEnabled = true,
  onAdvanceStage,
  onReceivePayment,
  onPrintReceipt,
  onReprintQr,
  onUndoClaim,
  onUndoVoid,
}: TransactionDetailModalProps) {
  const { members: loyaltyMembers } = useLoyaltyMembers();
  const [printing, setPrinting] = useState(false);

  const businessProfile = useMemo(() => {
    return loadBusinessProfile();
  }, [open]);

  const isLoyaltyMember = useMemo(() => {
    if (!loyaltyEnabled || !transaction || !loyaltyMembers || loyaltyMembers.length === 0) return false;
    const cleanPhone = (transaction.phone || "").replace(/\D/g, "");
    if (cleanPhone.length >= 7) {
      const match = loyaltyMembers.some((m) => m.phone && m.phone.replace(/\D/g, "").includes(cleanPhone));
      if (match) return true;
    }
    const cleanName = (transaction.customerName || "").trim().toLowerCase();
    if (cleanName.length >= 2) {
      const match = loyaltyMembers.some((m) => m.name.trim().toLowerCase() === cleanName);
      if (match) return true;
    }
    return false;
  }, [loyaltyEnabled, transaction, loyaltyMembers]);

  if (!transaction) return null;

  const stepIndex = getStepIndex(transaction.status);
  const isVoided = transaction.status === "Voided";
  const isClaimed = transaction.status === "Claimed";
  const isPaid = transaction.paymentStatus?.toLowerCase() === "paid";

  const handlePrintSlip = async () => {
    if (onPrintReceipt) {
      onPrintReceipt(transaction);
      return;
    }
    try {
      setPrinting(true);
      await printQrTicketOnly(transaction, businessProfile);
    } catch {
      // Ignore print errors
    } finally {
      setPrinting(false);
    }
  };

  const handleReprint = async () => {
    if (onReprintQr) {
      onReprintQr(transaction);
      return;
    }
    await handlePrintSlip();
  };

  const handleAdvance = () => {
    if (onAdvanceStage) {
      onAdvanceStage(transaction);
      return;
    }
    if (onEditStatus) {
      onOpenChange(false);
      onEditStatus(transaction.ticketId);
    }
  };

  const handlePayment = () => {
    if (onReceivePayment) {
      onReceivePayment(transaction);
      return;
    }
    if (onEditStatus) {
      onOpenChange(false);
      onEditStatus(transaction.ticketId);
    }
  };

  // Split drop-off datetime into readable date and time
  const arrivalFormatted = formatReadableDateTime(transaction.arrivalDateTime) || transaction.arrivalDateTime || "";
  const [dropoffDate, dropoffTime] = arrivalFormatted.includes(",")
    ? arrivalFormatted.split(",").map((s) => s.trim())
    : [arrivalFormatted, ""];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-lg w-full max-h-[92vh] overflow-hidden flex flex-col justify-end sm:justify-center">
        <DialogTitle className="sr-only">
          {`Ticket Details — ${transaction.ticketId}`}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Detailed view and actions for transaction {transaction.ticketId}
        </DialogDescription>

        {/* ── MOBILE DRAWER / DESKTOP MODAL CONTAINER ──────────────────────── */}
        <div className="relative w-full bg-card rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
          {/* Drag Handle & Drawer Header */}
          <div className="pt-2.5 pb-2.5 px-4 flex flex-col items-center bg-muted/40 border-b border-border/60 shrink-0 sticky top-0 z-20 backdrop-blur-md">
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 mb-2 sm:hidden" />
            <div className="w-full flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <h2 className="font-bold text-sm sm:text-base text-foreground tracking-tight truncate">
                    Ticket Details
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-purple-700 text-white font-mono text-[11px] sm:text-xs font-bold tracking-wide shrink-0 shadow-xs">
                    {transaction.ticketId}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={handlePrintSlip}
                  title="Print Tag"
                  disabled={printing}
                >
                  {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={() => onOpenChange(false)}
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Scrollable Drawer Body */}
          <div className="p-3.5 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto overscroll-contain">
            {/* 1. Current Stage & Quick Payment Banner */}
            <div className="w-full bg-[#F6F1F9] dark:bg-purple-950/40 rounded-2xl p-3 flex items-center justify-between border border-purple-100/80 dark:border-purple-900/40 shadow-xs">
              <div className="flex flex-col min-w-0 pr-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Current Stage
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-200/70 dark:bg-purple-800 text-purple-900 dark:text-purple-100 text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-700 dark:bg-purple-300" />
                    {transaction.status}
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-foreground truncate mt-0.5">
                  {transaction.status === "Washing"
                    ? "Machine Processing • Active Cycle"
                    : transaction.status === "Ready"
                      ? "Drying Complete • Awaiting Pickup"
                      : transaction.status === "Claimed"
                        ? "Handed Over to Customer"
                        : transaction.status === "Voided"
                          ? "Cancelled & Voided"
                          : "Intake Checked • Ready for Wash"}
                </span>
              </div>

              <div className="flex flex-col items-end shrink-0 pl-2">
                <span className="text-[10px] text-muted-foreground font-medium">Payment</span>
                {isPaid ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold mt-0.5 shadow-xs border border-emerald-200/70 dark:border-emerald-800/40">
                    <Check className="w-3 h-3" /> Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[11px] font-bold mt-0.5 shadow-xs border border-rose-200/70 dark:border-rose-800/40">
                    <X className="w-3 h-3" /> Unpaid • ₱{transaction.fee}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Status Progress 4-Step Stepper */}
            {!isVoided ? (
              <div className="w-full bg-card rounded-2xl p-3 sm:p-4 border border-border/70 shadow-xs">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Status Progress
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">
                    Step {Math.max(1, stepIndex + 1)} of 4
                  </span>
                </div>

                {/* Horizontal Stepper */}
                <div className="relative flex items-center justify-between px-2 pt-1 pb-1">
                  <div className="absolute left-6 right-6 top-4 h-1 bg-muted rounded-full overflow-hidden -z-0">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{
                        width: stepIndex <= 0 ? "0%" : stepIndex === 1 ? "33.3%" : stepIndex === 2 ? "66.6%" : "100%",
                      }}
                    />
                  </div>

                  {STATUS_STEPS.map((step, idx) => {
                    const isDone = idx < stepIndex;
                    const isCurrent = idx === stepIndex;
                    const stepSubtext =
                      step === "Received"
                        ? dropoffTime || "Checked in"
                        : step === "Washing"
                          ? isDone
                            ? "Complete"
                            : isCurrent
                              ? "In drum"
                              : "Queue"
                          : step === "Ready"
                            ? isDone
                              ? "Ready"
                              : isCurrent
                                ? "At counter"
                                : "Next"
                            : isDone || isCurrent
                              ? "Claimed"
                              : "Pending";

                    return (
                      <div key={step} className="flex flex-col items-center relative z-10">
                        <div
                          className={cn(
                            "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs",
                            isDone
                              ? "bg-primary text-primary-foreground"
                              : isCurrent
                                ? "bg-purple-700 text-white ring-4 ring-purple-100 dark:ring-purple-900/50"
                                : "bg-muted text-muted-foreground border border-border",
                          )}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                        </div>
                        <span
                          className={cn(
                            "text-[11px] sm:text-xs font-bold mt-1 text-center",
                            isCurrent
                              ? "text-primary"
                              : isDone
                                ? "text-foreground"
                                : "text-muted-foreground",
                          )}
                        >
                          {step}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground truncate max-w-[65px] text-center">
                          {stepSubtext}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="w-full bg-destructive/10 rounded-2xl p-3 border border-destructive/20 text-destructive flex items-center gap-2">
                <Circle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold">
                  This transaction has been voided. {transaction.voidReason ? `Reason: ${transaction.voidReason}` : ""}
                </span>
              </div>
            )}

            {/* 3. Order Breakdown Grid (2 Columns) */}
            <div className="w-full bg-card rounded-2xl p-3 sm:p-4 border border-border/70 shadow-xs flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">Order Breakdown</span>
                </div>
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                  Standard Drop-off
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Customer */}
                <div className="bg-muted/40 rounded-xl p-2.5 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                    Customer
                  </span>
                  <div className="mt-1">
                    <div className="font-bold text-foreground text-xs sm:text-sm truncate">
                      {transaction.customerName}
                    </div>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {transaction.phone || "No phone registered"}
                    </span>
                    {loyaltyEnabled && isLoyaltyMember && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 px-1.5 py-0.2 text-[9px] font-semibold mt-1">
                        <Sparkles className="w-2.5 h-2.5 text-amber-500 fill-amber-500" /> Member
                      </span>
                    )}
                  </div>
                </div>

                {/* Drop-off Time */}
                <div className="bg-muted/40 rounded-xl p-2.5 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                    Drop-off Time
                  </span>
                  <div className="mt-1">
                    <div className="font-bold text-foreground text-xs sm:text-sm truncate">
                      {dropoffDate || "—"}
                    </div>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {dropoffTime || "Recorded"}
                    </span>
                  </div>
                </div>

                {/* Weight & Type */}
                <div className="bg-muted/40 rounded-xl p-2.5 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                    Weight &amp; Type
                  </span>
                  <div className="mt-1">
                    <div className="flex items-baseline gap-1">
                      <span className="font-extrabold text-foreground text-sm sm:text-base">
                        {transaction.weight > 0 ? transaction.weight : "Per load"}
                      </span>
                      {transaction.weight > 0 && (
                        <span className="text-[10px] font-bold text-muted-foreground">kg</span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-primary block truncate">
                      {transaction.washType}
                    </span>
                  </div>
                </div>

                {/* Add-ons */}
                <div className="bg-muted/40 rounded-xl p-2.5 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                    Add-ons
                  </span>
                  <div className="mt-1">
                    <div className="font-bold text-foreground text-xs sm:text-sm truncate">
                      {transaction.addOns && transaction.addOns.length > 0
                        ? transaction.addOns.join(", ")
                        : "None"}
                    </div>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      Standard Care
                    </span>
                  </div>
                </div>

                {/* Total Bill */}
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-2.5 flex flex-col justify-between border border-purple-200/50 dark:border-purple-900/30">
                  <span className="text-[10px] text-purple-900 dark:text-purple-200 uppercase tracking-wider font-bold">
                    Total Bill
                  </span>
                  <div className="mt-1 flex items-baseline justify-between gap-1">
                    <span className="text-base sm:text-lg font-extrabold text-foreground tabular-nums">
                      ₱{transaction.fee.toLocaleString()}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.2 rounded-full",
                        isPaid
                          ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/50"
                          : "text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/50",
                      )}
                    >
                      {isPaid ? "Paid" : "Collect at Pickup"}
                    </span>
                  </div>
                </div>

                {/* Estimated Completion */}
                <div className="bg-muted/40 rounded-xl p-2.5 flex flex-col justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                    Completion ETA
                  </span>
                  <div className="mt-1">
                    <div className="font-bold text-foreground text-xs sm:text-sm truncate">
                      {transaction.eta ? formatReadableDateTime(transaction.eta) : "Est. 45–60 mins"}
                    </div>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      Standard cycle
                    </span>
                  </div>
                </div>

                {/* Instructions if present */}
                {transaction.washInstructions && (
                  <div className="col-span-2 bg-muted/40 rounded-xl p-2.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                      Special Instructions
                    </span>
                    <p className="text-xs text-foreground mt-0.5 font-medium">{transaction.washInstructions}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Pickup Verification QR Code Card */}
            <div className="w-full bg-card rounded-2xl p-3.5 sm:p-4 border border-border/70 shadow-xs flex flex-col items-center text-center">
              <div className="w-full flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">Pickup Verification</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full">
                  {transaction.ticketId}
                </span>
              </div>

              {/* QR Image Container */}
              <div className="p-2.5 bg-muted/30 rounded-2xl my-1 border border-border/60 shadow-inner flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getQrCodeImageUrl(transaction, 160)}
                  alt={`QR Verification for ${transaction.ticketId}`}
                  width={140}
                  height={140}
                  className="rounded-lg shadow-xs"
                  crossOrigin="anonymous"
                />
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground max-w-xs mt-1 leading-snug">
                Scan QR code at counter terminal or tracking portal for hand-over.
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-[10px] sm:text-xs font-medium">
                <Store className="w-3.5 h-3.5 text-primary" />
                <span>{businessProfile.shopName || "Sunshine Laundry"} • Counter Terminal</span>
              </div>
            </div>

            {/* 5. Operational Action Controls */}
            <div className="w-full flex flex-col gap-2 pt-1">
              {/* Primary Stage Advancement Button */}
              {!isVoided && !isClaimed && (
                <Button
                  onClick={handleAdvance}
                  className="w-full h-11 sm:h-12 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>
                    {transaction.status === "Received"
                      ? "Advance to Washing →"
                      : transaction.status === "Washing"
                        ? "Advance to Ready (Drying Complete) →"
                        : "Mark as Claimed (Hand Over) →"}
                  </span>
                </Button>
              )}


              {/* Secondary Buttons Grid: Payment + Thermal Receipt */}
              <div className="grid grid-cols-2 gap-2">
                {!isPaid ? (
                  <Button
                    onClick={handlePayment}
                    variant="outline"
                    className="h-10 sm:h-11 rounded-xl font-bold text-xs sm:text-sm bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-200 dark:bg-purple-950/60 dark:hover:bg-purple-900 dark:text-purple-200 dark:border-purple-800 flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Receive ₱{transaction.fee}</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    className="h-10 sm:h-11 rounded-xl font-bold text-xs sm:text-sm bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 flex items-center justify-center gap-1.5 opacity-80"
                  >
                    <Check className="w-4 h-4" />
                    <span>Payment Received</span>
                  </Button>
                )}

                <Button
                  onClick={handleReprint}
                  variant="outline"
                  disabled={printing}
                  className="h-10 sm:h-11 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all"
                >
                  {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4 text-primary" />}
                  <span>Thermal Receipt</span>
                </Button>
              </div>

              {/* Edit full details action */}
              {onEditStatus && !isVoided && !isClaimed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onEditStatus(transaction.ticketId);
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground h-8"
                >
                  <Edit className="w-3.5 h-3.5 mr-1" /> Edit Full Order Details
                </Button>
              )}
            </div>

            {/* 6. Swipe Down or Tap to Collapse */}
            <div className="pt-1 flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full py-2.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer active:scale-[0.99]"
              >
                <ChevronDown className="w-4 h-4" />
                <span>Swipe down or tap to collapse</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
