"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type Transaction, type TransactionStatus } from "@/lib/data";
import { StatusBadge, PaymentBadge } from "@/components/status-badge";
import { CheckCircle2, Circle, CircleDot, Edit, Sparkles } from "lucide-react";
import { useLoyaltyMembers } from "@/hooks/use-loyalty-members";
import { formatReadableDateTime } from "@/lib/date-format";

interface TransactionDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onEditStatus?: (ticketId: string) => void;
  loyaltyEnabled?: boolean;
}

const STATUS_STEPS: TransactionStatus[] = ["Received", "Washing", "Ready", "Claimed"];

function getStepIndex(status: TransactionStatus): number {
  if (status === "Voided") return -1;
  if (status === "Drying") return 1;
  return STATUS_STEPS.indexOf(status);
}

export function TransactionDetailModal({ open, onOpenChange, transaction, onEditStatus, loyaltyEnabled = true }: TransactionDetailModalProps) {
  const { members: loyaltyMembers } = useLoyaltyMembers();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-base">
            <span className="font-mono text-primary">{transaction.ticketId}</span>
            <StatusBadge status={transaction.status} />
          </DialogTitle>
          <DialogDescription className="sr-only">
            Transaction details for {transaction.ticketId} — {transaction.customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* Customer & Drop-off */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Customer</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{transaction.customerName}</p>
                {loyaltyEnabled && isLoyaltyMember && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 px-2 py-0.5 text-[10px] font-semibold shrink-0"
                    title="Registered Loyalty Member"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-amber-500 fill-amber-500" aria-hidden="true" />
                    Loyalty Member
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Phone</p>
              <p className="text-sm text-foreground">{transaction.phone || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Drop-off Date &amp; Time</p>
              <p className="text-sm text-foreground">{formatReadableDateTime(transaction.arrivalDateTime) || transaction.arrivalDateTime}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Wash Type</p>
              <p className="text-sm text-foreground">{transaction.washType}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Weight</p>
              <p className="text-sm text-foreground">{transaction.weight > 0 ? `${transaction.weight} kg` : "Per load"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Add-ons</p>
              <p className="text-sm text-foreground">
                {transaction.addOns.length > 0 ? transaction.addOns.join(", ") : "None"}
              </p>
            </div>
            {transaction.washInstructions && (
              <div className="col-span-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Instructions</p>
                <p className="text-sm text-foreground">{transaction.washInstructions}</p>
              </div>
            )}
          </div>

          {/* Status timeline */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Status Timeline</p>
            {isVoided ? (
              <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                <Circle className="w-4 h-4" aria-hidden="true" />
                This transaction has been voided.
              </div>
            ) : (
              <div className="flex items-center gap-0">
                {STATUS_STEPS.map((step, i) => {
                  const done    = i < stepIndex;
                  const current = i === stepIndex;
                  return (
                    <div key={step} className="flex items-center">
                      <div className="flex flex-col items-center gap-1">
                        {done ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" aria-hidden="true" />
                        ) : current ? (
                          <CircleDot className="w-5 h-5 text-primary" aria-hidden="true" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground/40" aria-hidden="true" />
                        )}
                        <span className={[
                          "text-xs font-medium text-center leading-tight",
                          done || current ? "text-foreground" : "text-muted-foreground",
                          current ? "font-semibold" : "",
                        ].join(" ")}>
                          {step}
                        </span>
                      </div>
                      {i < STATUS_STEPS.length - 1 && (
                        <div className={[
                          "h-0.5 w-6 sm:w-10 mb-4",
                          i < stepIndex ? "bg-primary" : "bg-border",
                        ].join(" ")} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fee breakdown */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fee</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-primary tabular-nums">₱{transaction.fee.toLocaleString()}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-primary/10 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Status</span>
              <PaymentBadge paymentStatus={transaction.paymentStatus} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Close
          </Button>
          {onEditStatus && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onEditStatus(transaction.ticketId);
              }}
              className="cursor-pointer gap-1.5"
            >
              <Edit className="w-3.5 h-3.5" aria-hidden="true" /> Edit Status
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
