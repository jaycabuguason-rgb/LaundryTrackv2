"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Transaction, type TransactionStatus, statusColors } from "@/lib/data";
import { CheckCircle2, Circle, Edit } from "lucide-react";

interface TransactionDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onEditStatus?: (ticketId: string) => void;
}

const STATUS_STEPS: TransactionStatus[] = ["Received", "Washing", "Drying", "Processing", "Ready", "Claimed"];

function getStepIndex(status: TransactionStatus): number {
  if (status === "Voided") return -1;
  return STATUS_STEPS.indexOf(status);
}

export function TransactionDetailModal({ open, onOpenChange, transaction, onEditStatus }: TransactionDetailModalProps) {
  if (!transaction) return null;

  const stepIndex = getStepIndex(transaction.status);
  const isVoided = transaction.status === "Voided";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-base">
            <span className="font-mono text-primary">{transaction.ticketId}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[transaction.status]}`}>
              {transaction.status}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Transaction details for {transaction.ticketId} — {transaction.customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* Customer & Drop-off */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Customer</p>
              <p className="text-sm font-semibold text-foreground">{transaction.customerName}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Phone</p>
              <p className="text-sm text-foreground">{transaction.phone || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Drop-off Date &amp; Time</p>
              <p className="text-sm text-foreground">{transaction.arrivalDateTime}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Wash Type</p>
              <p className="text-sm text-foreground">{transaction.washType}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Weight</p>
              <p className="text-sm text-foreground">{transaction.weight > 0 ? `${transaction.weight} kg` : "Per load"}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Add-ons</p>
              <p className="text-sm text-foreground">
                {transaction.addOns.length > 0 ? transaction.addOns.join(", ") : "None"}
              </p>
            </div>
            {transaction.washInstructions && (
              <div className="col-span-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Instructions</p>
                <p className="text-sm text-foreground">{transaction.washInstructions}</p>
              </div>
            )}
          </div>

          {/* Status timeline */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Status Timeline</p>
            {isVoided ? (
              <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                <Circle className="w-4 h-4" />
                This transaction has been voided.
              </div>
            ) : (
              <div className="flex items-center gap-0">
                {STATUS_STEPS.map((step, i) => {
                  const done    = i < stepIndex;
                  const current = i === stepIndex;
                  const pending = i > stepIndex;
                  return (
                    <div key={step} className="flex items-center">
                      <div className="flex flex-col items-center gap-1">
                        {done ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : current ? (
                          <div className="w-5 h-5 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-border bg-background" />
                        )}
                        <span className={[
                          "text-[10px] font-medium text-center leading-tight",
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
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fee</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-primary">₱{transaction.fee.toLocaleString()}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-primary/10 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Payment Status</span>
              <span className={[
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                transaction.paymentStatus === "paid"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-600 border-red-200",
              ].join(" ")}>
                {transaction.paymentStatus === "paid" ? "Paid" : "Unpaid"}
              </span>
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
              <Edit className="w-3.5 h-3.5" /> Edit Status
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
