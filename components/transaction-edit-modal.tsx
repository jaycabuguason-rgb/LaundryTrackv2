"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Transaction, type TransactionStatus } from "@/lib/data";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TransactionEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onSave: (ticketId: string, updates: Partial<Transaction>) => Promise<void>;
}

const STATUS_OPTIONS = [
  { value: "Received" as const, dot: "bg-blue-500",   text: "text-blue-700"   },
  { value: "Washing"  as const, dot: "bg-yellow-500", text: "text-yellow-700" },
  { value: "Drying"   as const, dot: "bg-orange-500", text: "text-orange-700" },
  { value: "Ready"    as const, dot: "bg-green-500",  text: "text-green-700"  },
  { value: "Claimed"  as const, dot: "bg-gray-400",   text: "text-gray-600"   },
  { value: "Voided"   as const, dot: "bg-red-500",    text: "text-red-700"    },
];

export function TransactionEditModal({ open, onOpenChange, transaction, onSave }: TransactionEditModalProps) {
  const [status, setStatus] = useState<TransactionStatus>("Received");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">("unpaid");
  const [washInstructions, setWashInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showClaimConfirm, setShowClaimConfirm] = useState(false);

  useEffect(() => {
    if (transaction && open) {
      setStatus(transaction.status);
      setPaymentStatus(transaction.paymentStatus);
      setWashInstructions(transaction.washInstructions ?? "");
      setHasChanges(false);
    }
  }, [transaction, open]);

  useEffect(() => {
    if (!transaction) return;
    const changed =
      status !== transaction.status ||
      paymentStatus !== transaction.paymentStatus ||
      (washInstructions ?? "") !== (transaction.washInstructions ?? "");
    setHasChanges(changed);
  }, [status, paymentStatus, washInstructions, transaction]);

  const requestClose = () => {
    if (hasChanges) setShowDiscardConfirm(true);
    else onOpenChange(false);
  };

  const handleSave = async () => {
    if (!transaction) return;
    if (status === "Claimed" && paymentStatus === "unpaid") {
      toast({
        title: "Payment required",
        description: "Mark payment as Paid first before claiming this ticket.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await onSave(transaction.ticketId, {
        status,
        paymentStatus,
        washInstructions,
      });
      setHasChanges(false);
      toast({
        title: "Transaction Updated",
        description: `${transaction.ticketId} has been updated successfully.`,
      });
      setTimeout(() => onOpenChange(false), 100);
    } catch (error) {
      console.error("Failed to save transaction:", error);
      toast({
        title: "Error",
        description: "Failed to update transaction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMoveToClaimed = async () => {
    if (!transaction) return;
    setSaving(true);
    try {
      await onSave(transaction.ticketId, {
        status: "Claimed",
        paymentStatus: "paid",
        washInstructions,
      });
      setHasChanges(false);
      toast({
        title: "Success",
        description: `${transaction.ticketId} has been marked as Claimed!`,
      });
      setShowClaimConfirm(false);
      setTimeout(() => onOpenChange(false), 100);
    } catch (error) {
      console.error("Failed to mark as claimed:", error);
      toast({
        title: "Error",
        description: "Failed to mark as claimed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!transaction) return null;

  const showMoveToClaimed = status === "Ready" && paymentStatus === "paid";
  const showUnpaidWarning = paymentStatus === "unpaid" && (status === "Ready" || status === "Claimed");

  return (
    <>
      <Dialog
        open={open && !showDiscardConfirm}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        modal
      >
        <DialogContent
          className="w-[calc(100vw-1rem)] sm:w-auto max-w-lg max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => {
            if (hasChanges) {
              e.preventDefault();
              setShowDiscardConfirm(true);
            }
          }}
          onEscapeKeyDown={(e) => {
            if (hasChanges) {
              e.preventDefault();
              setShowDiscardConfirm(true);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit Ticket — {transaction.ticketId}</DialogTitle>
            <DialogDescription>Update status and payment for this transaction.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Read-only summary */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: "Customer",  value: transaction.customerName },
                { label: "Wash Type", value: transaction.washType },
                { label: "Weight",    value: transaction.weight > 0 ? `${transaction.weight} kg` : "Per load" },
                { label: "Fee",       value: `₱${transaction.fee}` },
              ].map((row) => (
                <div key={row.label} className="bg-muted/30 rounded-md p-2.5">
                  <p className="text-[11px] text-muted-foreground">{row.label}</p>
                  <p className="font-medium text-foreground text-xs mt-0.5">{row.value}</p>
                </div>
              ))}
            </div>

            {/* Current Status */}
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Current Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as TransactionStatus)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(({ value, dot, text }) => {
                    const blocked = value === "Claimed" && paymentStatus === "unpaid";
                    return (
                      <SelectItem key={value} value={value} disabled={blocked}>
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
                          <span className={cn("font-medium text-xs", text)}>{value}</span>
                          {blocked && (
                            <span className="ml-1 text-[10px] text-muted-foreground">(payment required)</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Status */}
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Payment Status</label>
              <div className="grid grid-cols-2 gap-2">
                {(["unpaid", "paid"] as const).map((ps) => (
                  <button
                    key={ps}
                    type="button"
                    onClick={() => setPaymentStatus(ps)}
                    className={cn(
                      "rounded-lg border-2 py-2.5 px-3 text-xs font-semibold transition-colors duration-200 cursor-pointer",
                      ps === "unpaid"
                        ? paymentStatus === "unpaid"
                          ? "border-red-500 bg-red-50 text-red-600"
                          : "border-border bg-background text-muted-foreground hover:border-red-400 hover:bg-red-50 hover:text-red-600"
                        : paymentStatus === "paid"
                          ? "border-green-500 bg-green-50 text-green-600"
                          : "border-border bg-background text-muted-foreground hover:border-green-400 hover:bg-green-50 hover:text-green-600",
                    )}
                  >
                    {ps === "unpaid" ? "Unpaid" : "Paid"}
                  </button>
                ))}
              </div>
            </div>

            {/* Wash Instructions */}
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Wash Instructions</label>
              <Textarea
                placeholder="Add special wash instructions..."
                value={washInstructions}
                onChange={(e) => setWashInstructions(e.target.value)}
                className="text-sm resize-none"
                rows={2}
              />
            </div>

            {/* Warning */}
            {showUnpaidWarning && (
              <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 text-sm text-orange-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Mark payment as Paid first before claiming this ticket.</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {showMoveToClaimed && (
                <Button
                  size="sm"
                  onClick={() => setShowClaimConfirm(true)}
                  disabled={saving}
                  className="flex-1 gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Move to Claimed
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex-1 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={requestClose}
                disabled={saving}
                className="flex-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation */}
      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <DialogTitle className="text-base">Unsaved Changes</DialogTitle>
            </div>
            <DialogDescription className="text-sm pl-[52px]">
              You have unsaved changes. Are you sure you want to discard them?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
              Keep Editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDiscardConfirm(false);
                setHasChanges(false);
                onOpenChange(false);
              }}
            >
              Discard Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move to Claimed confirmation */}
      <AlertDialog open={showClaimConfirm} onOpenChange={setShowClaimConfirm}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Claim</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">Mark {transaction.ticketId} as Claimed?</span>
              <span className="block font-medium text-foreground">Customer: {transaction.customerName}</span>
              <span className="block text-xs text-muted-foreground">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMoveToClaimed} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Claim"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
