"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, CheckCircle, XCircle, AlertTriangle, Printer } from "lucide-react";
import QRScanner from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintReceiptModal } from "@/components/print-receipt-modal";
import { auditLogs as initialLogs, statusColors, type AuditLog, type Transaction, type PaymentStatus } from "@/lib/data";
import type { UpdateTransactionInput } from "@/lib/transaction-contracts";
import { cn } from "@/lib/utils";

interface ClaimVerificationPageProps {
  transactions: Transaction[];
  loading?: boolean;
  error?: string | null;
  onUpdateTransaction: (ticketId: string, updates: UpdateTransactionInput) => Promise<Transaction>;
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

  const isAutoLookupQuery = useCallback((value: string) => {
    const trimmed = value.trim();
    return /^TKT-[A-Z0-9-]+$/i.test(trimmed) || /^[a-f0-9]{16,64}$/i.test(trimmed);
  }, []);

  useEffect(() => {
    if (result) {
      const updated = transactions.find((transaction) => transaction.ticketId === result.ticketId);
      if (updated) {
        setResult(updated);
        setPaymentToggle(updated.paymentStatus);
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
      selectTransaction(found, notes);
      return;
    }

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

    setSubmitting(true);
    try {
      const updated = await onUpdateTransaction(result.ticketId, {
        status: "Claimed",
        paymentStatus: paymentToggle,
      });
      addLog(updated.ticketId, "Claimed", "Via Claim Verification", paymentToggle, updated.customerName);
      setSuccessMessage(
        `${updated.ticketId} claimed. Payment marked as ${paymentToggle === "paid" ? "Paid" : "Unpaid"}.`,
      );
      setResult(updated);

      setTimeout(() => {
        setResult(null);
        setQuery("");
        setSuccessMessage("");
      }, 3000);
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
        return "bg-green-100 text-green-700";
      case "Denied":
        return "bg-red-100 text-red-700";
      case "Override":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const isAlreadyClaimed = result?.status === "Claimed";
  const isNotReady = result && result.status !== "Ready" && result.status !== "Claimed";

  return (
    <div className="space-y-4 md:space-y-6">
      {successMessage && (
        <div className="animate-in fade-in slide-in-from-top-2 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">QR Code Scanner</CardTitle>
          </CardHeader>
          <CardContent>
            <QRScanner onScan={(value) => void handleScan(value)} />
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Manual Lookup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Claim code, Ticket ID, or customer name..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
                  className="h-10 pl-9 text-sm md:h-9"
                />
              </div>
              <Button size="sm" onClick={() => void handleSearch()} className="min-h-[44px] px-4 md:min-h-0" disabled={loading}>
                Search
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Paste the customer claim code or tracking QR token here and the matching transaction will open automatically.
            </p>

            {notFound && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-center text-sm text-red-600">
                No ticket found for &quot;{query}&quot;
              </div>
            )}

            {result && (
              <div className="space-y-3 rounded-lg border border-border p-3 md:p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: "Ticket ID", value: result.ticketId },
                    { label: "Customer", value: result.customerName },
                    { label: "Drop-off Date", value: result.dropOffDate },
                    { label: "Wash Type", value: result.washType },
                  ].map((row) => (
                    <div key={row.label} className="rounded bg-muted/30 p-2.5">
                      <p className="text-[11px] text-muted-foreground">{row.label}</p>
                      <p className="mt-0.5 text-xs font-medium text-foreground">{row.value}</p>
                    </div>
                  ))}
                  <div className="rounded bg-muted/30 p-2.5">
                    <p className="text-[11px] text-muted-foreground">Total Fee</p>
                    <p className="mt-0.5 text-xs font-medium text-foreground">PHP {result.fee.toLocaleString()}</p>
                  </div>
                  <div className="rounded bg-muted/30 p-2.5">
                    <p className="text-[11px] text-muted-foreground">ETA</p>
                    <p className="mt-0.5 text-xs font-medium text-foreground">
                      {result.eta ?? "Awaiting estimate"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusColors[result.status])}>
                      {result.status}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">Payment:</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                        result.paymentStatus === "paid" ? "bg-green-500 text-white" : "bg-red-500 text-white",
                      )}
                    >
                      {result.paymentStatus}
                    </span>
                  </div>

                  {!isAlreadyClaimed && (
                    <div className="rounded-lg border border-border bg-muted/20 p-2.5">
                      <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Update Payment Status</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={paymentToggle === "unpaid" ? "default" : "outline"}
                          className={cn(
                            "h-8 flex-1 text-xs",
                            paymentToggle === "unpaid" && "bg-red-500 text-white hover:bg-red-600",
                          )}
                          onClick={() => setPaymentToggle("unpaid")}
                        >
                          Unpaid
                        </Button>
                        <Button
                          size="sm"
                          variant={paymentToggle === "paid" ? "default" : "outline"}
                          className={cn(
                            "h-8 flex-1 text-xs",
                            paymentToggle === "paid" && "bg-green-500 text-white hover:bg-green-600",
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
                  <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                    <div>
                      <p className="font-semibold">Already Claimed</p>
                      <p className="mt-0.5 text-xs">This ticket has already been claimed.</p>
                    </div>
                  </div>
                )}

                {isNotReady && (
                  <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                    <div>
                      <p className="font-semibold">Not Ready for Pickup</p>
                      <p className="mt-0.5 text-xs">Current status: {result.status}</p>
                    </div>
                  </div>
                )}

                {!denyMode ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap gap-2">
                      {!isAlreadyClaimed && (
                        <Button
                          size="sm"
                          className={cn(
                            "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 sm:min-h-0 sm:flex-none",
                            isNotReady ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-green-600 text-white hover:bg-green-700",
                          )}
                          onClick={() => void handleClaim()}
                          disabled={submitting}
                        >
                          {isNotReady ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          {isNotReady ? "Claim Anyway" : "Confirm Claim & Save"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 sm:min-h-0 sm:flex-none"
                        onClick={handleReprintReceipt}
                      >
                        <Printer className="h-3.5 w-3.5" /> Reprint Receipt
                      </Button>
                      {!isAlreadyClaimed && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 sm:min-h-0 sm:flex-none"
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
                      placeholder="Reason for denial (optional)..."
                      value={denyReason}
                      onChange={(event) => setDenyReason(event.target.value)}
                      className="resize-none text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1 justify-center" onClick={confirmDeny}>
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

      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Audit Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/40">
                  {["Date / Time", "Ticket ID", "Customer", "Action", "Payment Status", "Staff", "Notes"].map((header) => (
                    <th key={header} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{log.dateTime}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-primary">{log.ticketId}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{log.customerName || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", actionBadgeColor(log.action))}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.paymentStatus ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                            log.paymentStatus === "paid" ? "bg-green-500 text-white" : "bg-red-500 text-white",
                          )}
                        >
                          {log.paymentStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">{log.staff}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{log.notes || "-"}</td>
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
