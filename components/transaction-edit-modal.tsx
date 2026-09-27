"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { AlertTriangle, Check, Edit, Loader2, X } from "lucide-react";
import { getStatusIcon } from "@/components/status-badge";
import { toast } from "@/hooks/use-toast";
import { showAppErrorToast } from "@/lib/error-toast";
import { cn } from "@/lib/utils";

interface TransactionEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onSave: (ticketId: string, updates: Partial<Transaction>) => Promise<void>;
}

const STATUS_OPTIONS: { value: TransactionStatus; dot: string; text: string }[] = [
  { value: "Received", dot: "bg-purple-500", text: "text-purple-700 dark:text-purple-300" },
  { value: "Washing",  dot: "bg-blue-500",   text: "text-blue-700 dark:text-blue-300" },
  { value: "Ready",    dot: "bg-green-500",  text: "text-green-700 dark:text-green-300" },
  { value: "Claimed",  dot: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-300" },
  { value: "Voided",   dot: "bg-red-500",    text: "text-red-700 dark:text-red-300" },
];

export function TransactionEditModal({ open, onOpenChange, transaction, onSave }: TransactionEditModalProps) {
  const [status, setStatus] = useState<TransactionStatus>("Received");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">("unpaid");
  const [washInstructions, setWashInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showClaimConfirm, setShowClaimConfirm] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (transaction && open) {
      setStatus(transaction.status);
      setPaymentStatus(transaction.paymentStatus);
      setWashInstructions(transaction.washInstructions ?? "");
      setHasChanges(false);
      setEditError(null);
    }
  }, [transaction, open]);

  useEffect(() => {
    if (!transaction) return;
    const changed =
      status !== transaction.status ||
      paymentStatus !== transaction.paymentStatus ||
      (washInstructions ?? "") !== (transaction.washInstructions ?? "");
    setHasChanges(changed);
    if (changed) setEditError(null);
  }, [status, paymentStatus, washInstructions, transaction]);

  const requestClose = () => {
    if (hasChanges) setShowDiscardConfirm(true);
    else onOpenChange(false);
  };

  const handleSave = async () => {
    if (!transaction) return;
    setEditError(null);
    if (status === "Claimed" && paymentStatus === "unpaid") {
      const msg = "Mark payment as Paid first before claiming this ticket.";
      setEditError(msg);
      toast({
        title: "Payment required",
        description: msg,
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
      const parsed = showAppErrorToast(error, {
        fallbackMessage: "Failed to update transaction. Please try again.",
        onRetry: () => void handleSave(),
      });
      setEditError(`${parsed.title}: ${parsed.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleMoveToClaimed = async () => {
    if (!transaction) return;
    setEditError(null);
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
      const parsed = showAppErrorToast(error, {
        fallbackMessage: "Failed to mark as claimed. Please try again.",
        onRetry: () => void handleMoveToClaimed(),
      });
      setEditError(`${parsed.title}: ${parsed.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!transaction) return null;

  const showMoveToClaimed = status === "Ready" && paymentStatus === "paid";
  const showUnpaidWarning = paymentStatus === "unpaid" && (status === "Ready" || status === "Claimed");

  return (
    <>
      <Drawer
        open={open && !showDiscardConfirm}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DrawerContent
          className="bg-card border-t border-border text-foreground shadow-2xl max-w-lg mx-auto rounded-t-3xl data-[vaul-drawer-direction=bottom]:max-h-[90vh] flex flex-col p-0 overflow-hidden outline-none"
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
          {/* Retractable Handle Bar & Sticky Drawer Header */}
          <div className="pt-2.5 pb-2.5 px-4 flex flex-col items-center bg-muted/40 border-b border-border/60 shrink-0 sticky top-0 z-20 backdrop-blur-md">
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 mb-2 cursor-grab active:cursor-grabbing" />
            <div className="w-full flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Edit className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <DrawerTitle className="font-bold text-sm sm:text-base text-foreground tracking-tight truncate">
                      Edit Ticket
                    </DrawerTitle>
                    <span className="px-2 py-0.5 rounded-full bg-purple-700 text-white font-mono text-[11px] sm:text-xs font-bold tracking-wide shrink-0 shadow-xs">
                      {transaction.ticketId}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={requestClose}
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <DrawerDescription className="sr-only">
                Update status and payment for this transaction.
              </DrawerDescription>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain">
              {/* Read-only summary */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: "Customer",  value: transaction.customerName },
                  { label: "Wash Type", value: transaction.washType },
                  { label: "Weight",    value: transaction.weight > 0 ? `${transaction.weight} kg` : "Per load" },
                  { label: "Fee",       value: `₱${transaction.fee}` },
                ].map((row) => (
                  <div key={row.label} className="bg-muted/30 rounded-md p-2.5">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="font-medium text-foreground text-xs mt-0.5">{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Current Status */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Current Status</label>
                <Select
                  value={status === "Drying" ? "Washing" : status}
                  onValueChange={(v) => setStatus(v as TransactionStatus)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(({ value, text }) => {
                      const blocked = value === "Claimed" && paymentStatus === "unpaid";
                      return (
                        <SelectItem key={value} value={value} disabled={blocked}>
                          <div className="flex items-center gap-2">
                            <span className={cn("shrink-0", text)}>{getStatusIcon(value, "w-3.5 h-3.5")}</span>
                            <span className={cn("font-medium text-xs", text)}>{value}</span>
                            {blocked && (
                              <span className="ml-1 text-xs text-muted-foreground">(payment required)</span>
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

              {/* Error Alert */}
              {editError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 text-xs text-destructive animate-in fade-in-50 duration-200"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-semibold">{editError}</span>
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
        </DrawerContent>
      </Drawer>

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
