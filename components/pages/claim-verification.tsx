"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, CheckCircle, XCircle, AlertTriangle, Printer } from "lucide-react";
import QRScanner from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintReceiptModal } from "@/components/print-receipt-modal";
import { auditLogs as initialLogs, type AuditLog, type Transaction, type PaymentStatus } from "@/lib/data";
import { StatusBadge, PaymentBadge } from "@/components/status-badge";
import { CategoryBadge, SeverityBadge } from "@/components/pages/audit-logs";
import type { UpdateTransactionInput } from "@/lib/transaction-contracts";
import { cn } from "@/lib/utils";
import { playScanSuccessFeedback } from "@/lib/scanner-feedback";

interface ClaimVerificationPageProps {
  transactions: Transaction[];
  loading?: boolean;
  error?: string | null;
  onUpdateTransaction: (ticketId: string, updates: UpdateTransactionInput) => Promise<{ transaction: Transaction; loyaltyResult?: import("@/lib/transaction-contracts").StampAwardResult }>;
  onResolveScannedValue: (value: string) => Promise<string | null>;
}

export default function ClaimVerificationPage({
  transactions,
  loading = false,
  error = null,
  onUpdateTransaction,
  onResolveScannedValue,
}: ClaimVerificationPageProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Transaction | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [denyMode, setDenyMode] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [paymentToggle, setPaymentToggle] = useState<PaymentStatus>("unpaid");
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [reprintTransaction, setReprintTransaction] = useState<Transaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [claimedNotice, setClaimedNotice] = useState<string | null>(null);

  const isAutoLookupQuery = useCallback((value: string) => {
    const trimmed = value.trim();
    return /^TKT-[A-Z0-9-]+$/i.test(trimmed) || /^[a-f0-9]{16,64}$/i.test(trimmed);
  }, []);

  useEffect(() => {
    if (result) {
      const updated = transactions.find((transaction) => transaction.ticketId === result.ticketId);
      if (updated) {
        if (updated.status === "Claimed") {
          setResult(null);
        } else {
          setResult(updated);
          setPaymentToggle(updated.paymentStatus);
        }
      }
    }
  }, [transactions, result]);

  useEffect(() => {
    if (result) {
      setPaymentToggle(result.paymentStatus);
    }
  }, [result]);

  const addLog = (
    ticketId: string,
    action: AuditLog["action"],
    notes: string,
    paymentStatus?: PaymentStatus,
    customerName?: string,
  ) => {
    const newLog: AuditLog = {
      id: String(Date.now()),
      dateTime: new Date().toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short" }),
      ticketId,
      action,
      staff: "Admin",
      notes,
      paymentStatus,
      customerName,
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  const selectTransaction = (transaction: Transaction, notes: string) => {
    setResult(transaction);
    setPaymentToggle(transaction.paymentStatus);
    setNotFound(false);
    addLog(transaction.ticketId, "Scanned", notes, transaction.paymentStatus, transaction.customerName);
    if (notes !== "Via QR Scan") {
      playScanSuccessFeedback();
    }
  };

  const lookupTransaction = useCallback(async (value: string, notes: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setResult(null);
      setNotFound(false);
      return;
    }

    try {
      const resolvedTicketId = await onResolveScannedValue(trimmed);
      if (resolvedTicketId) {
        const resolved = transactions.find(
          (transaction) => transaction.ticketId.toLowerCase() === resolvedTicketId.toLowerCase(),
        );

        if (resolved) {
          if (resolved.status === "Claimed") {
            setResult(null);
            setNotFound(false);
            setClaimedNotice(resolved.ticketId);
            return;
          }
          setClaimedNotice(null);
          selectTransaction(resolved, notes);
          return;
        }
      }
    } catch {
      // Fall back to local matching below.
    }

    const normalizedQuery = trimmed.toLowerCase();
    const found = transactions.find(
      (transaction) =>
        transaction.ticketId.toLowerCase() === normalizedQuery ||
        transaction.customerName.toLowerCase().includes(normalizedQuery),
    );

    if (found) {
      if (found.status === "Claimed") {
        setResult(null);
        setNotFound(false);
        setClaimedNotice(found.ticketId);
        return;
      }
      setClaimedNotice(null);
      selectTransaction(found, notes);
      return;
    }

    setClaimedNotice(null);
    setResult(null);
    setNotFound(true);
  }, [onResolveScannedValue, transactions]);

  const handleSearch = useCallback(async () => {
    await lookupTransaction(query, "Via Manual Search");
  }, [lookupTransaction, query]);

  useEffect(() => {
    if (!isAutoLookupQuery(query)) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void lookupTransaction(query, "Via Claim Code");
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [isAutoLookupQuery, lookupTransaction, query]);

  const handleClaim = async () => {
    if (!result) return;
    if (paymentToggle === "unpaid") {
      setSuccessMessage("Mark payment as Paid first before claiming this ticket.");
      return;
    }
    const finalPayment: PaymentStatus = "paid";

    setSubmitting(true);
    try {
      const res = await onUpdateTransaction(result.ticketId, {
        status: "Claimed",
        paymentStatus: finalPayment,
      });
      const updated = res.transaction;
      setPaymentToggle(finalPayment);
      addLog(updated.ticketId, "Claimed", "Via Claim Verification", finalPayment, updated.customerName);
      setSuccessMessage(
        `Ticket #${updated.ticketId} for ${updated.customerName} has been successfully claimed and released.`,
      );
      setResult(null);
      setQuery("");
      setClaimedNotice(null);

      setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
    } catch {
      setSuccessMessage("Unable to save the claim right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeny = () => {
    if (!result) return;
    addLog(result.ticketId, "Denied", denyReason || "No reason provided", result.paymentStatus, result.customerName);
    setDenyMode(false);
    setDenyReason("");
    setResult(null);
    setQuery("");
  };

  const handleReprintReceipt = () => {
    if (!result) return;
    setReprintTransaction({
      ...result,
      paymentStatus: paymentToggle,
    });
    setReprintModalOpen(true);
  };

  const handleScan = useCallback(async (scannedValue: string) => {
    try {
      setQuery(scannedValue);
      await lookupTransaction(scannedValue, "Via QR Scan");
    } catch {
      setResult(null);
      setNotFound(true);
    }
  }, [lookupTransaction]);

  const actionBadgeColor = (action: AuditLog["action"]) => {
    switch (action) {
      case "Claimed":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20";
      case "Denied":
        return "bg-destructive/10 text-destructive border border-destructive/20";
      case "Override":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20";
      default:
        return "bg-primary/10 text-primary border border-primary/20";
    }
  };

  const isAlreadyClaimed = result?.status === "Claimed";
  const isNotReady = result && result.status !== "Ready" && result.status !== "Claimed";
  const isUnpaid = result && paymentToggle === "unpaid";

  return (
    <div className="space-y-4 md:space-y-6">
      {successMessage && (
        <div className="animate-in fade-in slide-in-from-top-2 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">QR Code Scanner</CardTitle>
          </CardHeader>
          <CardContent>
            <QRScanner onScan={(value) => void handleScan(value)} />
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Manual Lookup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Claim code, Ticket ID, or customer name…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
                  className="h-10 pl-9 text-sm md:h-9 bg-background"
                />
              </div>
              <Button size="sm" onClick={() => void handleSearch()} className="min-h-[44px] px-4 md:min-h-0" disabled={loading}>
                Search
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Paste the customer claim code or tracking QR token here and the matching transaction will open automatically.
            </p>

            {claimedNotice && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-sm text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-amber-600 dark:text-amber-400" />
                <p className="font-semibold">Ticket Already Claimed &amp; Disposed</p>
                <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">
                  Ticket #{claimedNotice} has already been claimed and released. It is disposed from active verification but remains in your records and Claimed History below.
                </p>
              </div>
            )}

            {notFound && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">
                No ticket found for &quot;{query}&quot;
              </div>
            )}

            {result && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3 md:p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: "Ticket ID", value: result.ticketId },
                    { label: "Customer", value: result.customerName },
                    { label: "Drop-off Date", value: result.dropOffDate },
                    { label: "Wash Type", value: result.washType },
                  ].map((row) => (
                    <div key={row.label} className="rounded-lg bg-background p-2.5 border border-border/60">
                      <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
                      <p className="mt-0.5 text-xs font-semibold text-foreground">{row.value}</p>
                    </div>
                  ))}
                  <div className="rounded-lg bg-background p-2.5 border border-border/60">
                    <p className="text-xs font-medium text-muted-foreground">Total Fee</p>
                    <p className="mt-0.5 text-xs font-semibold text-foreground">PHP {result.fee.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-background p-2.5 border border-border/60">
                    <p className="text-xs font-medium text-muted-foreground">ETA</p>
                    <p className="mt-0.5 text-xs font-semibold text-foreground">
                      {result.eta ?? "Awaiting estimate"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Status:</span>
                    <StatusBadge status={result.status} />
                    <span className="ml-2 text-xs font-medium text-muted-foreground">Payment:</span>
                    <PaymentBadge paymentStatus={result.paymentStatus} className="font-bold uppercase" />
                  </div>

                  {!isAlreadyClaimed && (
                    <div className="rounded-xl border border-border bg-background p-3">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Update Payment Status</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={paymentToggle === "unpaid" ? "default" : "outline"}
                          className={cn(
                            "h-8 flex-1 text-xs font-medium transition-colors",
                            paymentToggle === "unpaid" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                          )}
                          onClick={() => setPaymentToggle("unpaid")}
                        >
                          Unpaid
                        </Button>
                        <Button
                          size="sm"
                          variant={paymentToggle === "paid" ? "default" : "outline"}
                          className={cn(
                            "h-8 flex-1 text-xs font-medium transition-colors",
                            paymentToggle === "paid" && "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600",
                          )}
                          onClick={() => setPaymentToggle("paid")}
                        >
                          Paid
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {isAlreadyClaimed && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">Already Claimed</p>
                      <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">This ticket has already been claimed.</p>
                    </div>
                  </div>
                )}

                {isNotReady && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">Not Ready for Pickup</p>
                      <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">Current status: {result.status}</p>
                    </div>
                  </div>
                )}

                {isUnpaid && !isAlreadyClaimed && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">Payment Required</p>
                      <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">Mark payment as Paid first before claiming this ticket.</p>
                    </div>
                  </div>
                )}

                {!denyMode ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap gap-2">
                      {!isAlreadyClaimed && !isUnpaid && (
                        <Button
                          size="sm"
                          className={cn(
                            "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 font-medium sm:min-h-0 sm:flex-none transition-colors cursor-pointer",
                            isNotReady
                              ? "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
                              : "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600",
                          )}
                          onClick={() => void handleClaim()}
                          disabled={submitting}
                        >
                          {isNotReady ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          {isNotReady ? "Claim Anyway" : "Confirm Claim & Release"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 border-border hover:bg-accent hover:text-accent-foreground sm:min-h-0 sm:flex-none"
                        onClick={handleReprintReceipt}
                      >
                        <Printer className="h-3.5 w-3.5" /> Reprint Receipt
                      </Button>
                      {!isAlreadyClaimed && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 font-medium sm:min-h-0 sm:flex-none"
                          onClick={() => setDenyMode(true)}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Deny
                        </Button>
                      )}
                    </div>
                    {isAlreadyClaimed && (
                      <p className="text-center text-xs text-muted-foreground">
                        Ticket already claimed. Use Reprint Receipt to generate a copy.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      placeholder="Reason for denial (optional)…"
                      value={denyReason}
                      onChange={(event) => setDenyReason(event.target.value)}
                      className="resize-none text-sm bg-background border-border"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1 justify-center font-medium" onClick={confirmDeny}>
                        Confirm Deny
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 justify-center" onClick={() => setDenyMode(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Audit Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border md:hidden">
            {logs.map((log) => (
              <div key={log.id} className="space-y-3 p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                      {log.ticketId}
                    </span>
                    <p className="truncate text-sm font-medium text-foreground">{log.customerName || "-"}</p>
                    <p className="text-xs text-muted-foreground">{log.dateTime}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", actionBadgeColor(log.action))}>
                    {log.action}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2.5 border border-border/50">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment</p>
                    {log.paymentStatus ? (
                      <PaymentBadge paymentStatus={log.paymentStatus} className="mt-0.5 text-xs font-bold uppercase" />
                    ) : (
                      <p className="text-xs text-muted-foreground">-</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Staff</p>
                    <p className="mt-0.5 text-xs font-medium text-foreground">{log.staff}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
                    <p className="mt-0.5 text-xs text-foreground">{log.notes || "-"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[700px] text-sm text-left">
              <thead>
                <tr className="border-y border-border bg-muted/30">
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actor</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/80 hover:bg-muted/40 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">{log.dateTime}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-semibold text-xs text-foreground">{log.staff}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <CategoryBadge category={log.action.toLowerCase().includes("denied") ? "security" : "transaction"} />
                    </td>
                    <td className="px-4 py-3.5 font-medium text-xs text-foreground whitespace-nowrap">
                      {log.action} (#{log.ticketId})
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-xs truncate">
                      {log.notes || (log.customerName ? `Customer: ${log.customerName}` : "—")}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right">
                      <SeverityBadge severity={log.action.toLowerCase().includes("denied") ? "warning" : "info"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PrintReceiptModal
        open={reprintModalOpen}
        onOpenChange={setReprintModalOpen}
        transaction={reprintTransaction}
      />
    </div>
  );
}
