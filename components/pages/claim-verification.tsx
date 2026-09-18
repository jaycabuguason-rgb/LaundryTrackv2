"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, CheckCircle, XCircle, AlertTriangle, Printer, ArrowRight, Loader2 } from "lucide-react";
import QRScanner from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintReceiptModal } from "@/components/print-receipt-modal";
import { auditLogs as initialLogs, type AuditLog, type Transaction, type PaymentStatus } from "@/lib/data";
import { StatusBadge, PaymentBadge } from "@/components/status-badge";
import { CategoryBadge, SeverityBadge } from "@/components/pages/audit-logs";
import { formatReadableDateTime } from "@/lib/date-format";
import type { UpdateTransactionInput } from "@/lib/transaction-contracts";
import { cn } from "@/lib/utils";
import { playScanSuccessFeedback } from "@/lib/scanner-feedback";
import { useAuditLogs } from "@/hooks/use-audit-logs";

function highlightMatch(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const index = text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (index === -1) return text;
  const before = text.slice(0, index);
  const match = text.slice(index, index + trimmed.length);
  const after = text.slice(index + trimmed.length);
  return (
    <>
      {before}
      <span className="font-extrabold text-primary underline decoration-primary/40">{match}</span>
      {after}
    </>
  );
}

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
  const { auditLogs: liveAuditLogs, usingSupabase, logVerificationEvent } = useAuditLogs();

  const logs = useMemo(() => {
    // Only fall back to initialLogs if Supabase is unconfigured AND there are no live logs
    if (!usingSupabase && liveAuditLogs.length === 0) {
      return initialLogs.map((l) => ({
        ...l,
        isPending: false,
        isUnsaved: false,
      }));
    }

    return liveAuditLogs
      .filter((entry) => {
        const act = (entry.action || "").toLowerCase();
        return (
          act === "claim_scanned" ||
          act === "claim_verified" ||
          act === "claim_denied" ||
          act === "override" ||
          (entry.ticketId &&
            (act === "status_changed" || act === "transaction_updated") &&
            entry.details?.toLowerCase().includes("claim"))
        );
      })
      .map((entry) => {
        let displayAction: AuditLog["action"] = "Scanned";
        const act = (entry.action || "").toLowerCase();
        if (act === "claim_verified" || entry.details?.toLowerCase().includes("claim")) {
          displayAction = "Claimed";
        } else if (act === "claim_denied") {
          displayAction = "Denied";
        } else if (act === "override") {
          displayAction = "Override";
        } else {
          displayAction = "Scanned";
        }

        return {
          id: entry.id,
          dateTime: entry.timestamp,
          ticketId: entry.ticketId || "—",
          action: displayAction,
          staff: entry.staffName || "Staff",
          notes: entry.details || entry.summary || "",
          paymentStatus: entry.paymentStatus,
          customerName: entry.customerName,
          isPending: Boolean(entry.isPending),
          isUnsaved: Boolean(entry.isUnsaved),
        };
      });
  }, [liveAuditLogs, usingSupabase]);

  const [denyMode, setDenyMode] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [paymentToggle, setPaymentToggle] = useState<PaymentStatus>("unpaid");
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [reprintTransaction, setReprintTransaction] = useState<Transaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [claimedNotice, setClaimedNotice] = useState<string | null>(null);
  const [notReadyNotice, setNotReadyNotice] = useState<{
    ticketId: string;
    customerName: string;
    status: string;
  } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Autocomplete suggestions based on first letter or query match (Ready orders only)
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matches = transactions.filter((t) => {
      // Only suggest customers whose orders are in the Ready stage
      if (t.status !== "Ready") return false;

      const name = (t.customerName || "").toLowerCase();
      const ticket = (t.ticketId || "").toLowerCase();
      const phone = (t.phone || "").replace(/\D/g, "");
      const cleanQ = q.replace(/\D/g, "");
      return (
        name.includes(q) ||
        ticket.includes(q) ||
        (cleanQ.length >= 3 && phone.includes(cleanQ))
      );
    });

    return matches
      .sort((a, b) => {
        // 1. Prioritize names starting with query
        const aNameStarts = (a.customerName || "").toLowerCase().startsWith(q);
        const bNameStarts = (b.customerName || "").toLowerCase().startsWith(q);
        if (aNameStarts && !bNameStarts) return -1;
        if (!aNameStarts && bNameStarts) return 1;

        // 2. Prioritize tickets starting with query
        const aTicketStarts = (a.ticketId || "").toLowerCase().startsWith(q);
        const bTicketStarts = (b.ticketId || "").toLowerCase().startsWith(q);
        if (aTicketStarts && !bTicketStarts) return -1;
        if (!aTicketStarts && bTicketStarts) return 1;

        return 0;
      })
      .slice(0, 6);
  }, [query, transactions]);

  const handleSelectSuggestion = (transaction: Transaction) => {
    setQuery(transaction.customerName);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    setClaimedNotice(null);
    setNotReadyNotice(null);
    selectTransaction(transaction, "Via Name Suggestion");
  };

  const isAutoLookupQuery = useCallback((value: string) => {
    const trimmed = value.trim();
    return /^TKT-[A-Z0-9-]+$/i.test(trimmed) || /^[a-f0-9]{16,64}$/i.test(trimmed);
  }, []);

  useEffect(() => {
    if (result) {
      const updated = transactions.find((transaction) => transaction.ticketId === result.ticketId);
      if (updated) {
        if (updated.status !== "Ready") {
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

  const addLog = useCallback(
    (
      ticketId: string,
      action: AuditLog["action"],
      notes: string,
      paymentStatus?: PaymentStatus,
      customerName?: string,
    ) => {
      let auditAction: import("@/lib/audit-log-contracts").AuditActionType = "claim_scanned";
      if (action === "Claimed") auditAction = "claim_verified";
      else if (action === "Denied") auditAction = "claim_denied";
      else if (action === "Override") auditAction = "override";

      if (action === "Claimed" && usingSupabase) {
        return;
      }

      void logVerificationEvent({
        action: auditAction,
        ticketId,
        summary: `${action} ticket ${ticketId}`,
        details: notes,
        paymentStatus,
        customerName,
      });
    },
    [logVerificationEvent, usingSupabase],
  );

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
      setClaimedNotice(null);
      setNotReadyNotice(null);
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
            setNotReadyNotice(null);
            setClaimedNotice(resolved.ticketId);
            addLog(resolved.ticketId, "Scanned", `${notes} (Already Claimed)`, resolved.paymentStatus, resolved.customerName);
            return;
          }
          if (resolved.status !== "Ready") {
            setResult(null);
            setNotFound(false);
            setClaimedNotice(null);
            setNotReadyNotice({
              ticketId: resolved.ticketId,
              customerName: resolved.customerName,
              status: resolved.status,
            });
            addLog(resolved.ticketId, "Scanned", `${notes} (Not Ready: ${resolved.status})`, resolved.paymentStatus, resolved.customerName);
            return;
          }
          setClaimedNotice(null);
          setNotReadyNotice(null);
          selectTransaction(resolved, notes);
          return;
        }
      }
    } catch {
      // Fall back to local matching below.
    }

    const normalizedQuery = trimmed.toLowerCase();

    // 1. Search for a matching Ready transaction first
    const readyFound = transactions.find(
      (transaction) =>
        transaction.status === "Ready" &&
        (transaction.ticketId.toLowerCase() === normalizedQuery ||
          transaction.customerName.toLowerCase().includes(normalizedQuery)),
    );

    if (readyFound) {
      setClaimedNotice(null);
      setNotReadyNotice(null);
      selectTransaction(readyFound, notes);
      return;
    }

    // 2. If no Ready transaction found, check if an unready or claimed transaction matches
    const otherFound = transactions.find(
      (transaction) =>
        transaction.ticketId.toLowerCase() === normalizedQuery ||
        transaction.customerName.toLowerCase().includes(normalizedQuery),
    );

    if (otherFound) {
      if (otherFound.status === "Claimed") {
        setResult(null);
        setNotFound(false);
        setNotReadyNotice(null);
        setClaimedNotice(otherFound.ticketId);
        addLog(otherFound.ticketId, "Scanned", `${notes} (Already Claimed)`, otherFound.paymentStatus, otherFound.customerName);
        return;
      }
      setResult(null);
      setNotFound(false);
      setClaimedNotice(null);
      setNotReadyNotice({
        ticketId: otherFound.ticketId,
        customerName: otherFound.customerName,
        status: otherFound.status,
      });
      addLog(otherFound.ticketId, "Scanned", `${notes} (Not Ready: ${otherFound.status})`, otherFound.paymentStatus, otherFound.customerName);
      return;
    }

    setClaimedNotice(null);
    setNotReadyNotice(null);
    setResult(null);
    setNotFound(true);
  }, [addLog, onResolveScannedValue, transactions]);

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
    setNotReadyNotice(null);
    setClaimedNotice(null);
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
      setNotReadyNotice(null);
      setClaimedNotice(null);
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
              <div className="relative flex-1" ref={containerRef}>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none" />
                <Input
                  placeholder="Claim code, Ticket ID, or customer name…"
                  value={query}
                  autoComplete="off"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setShowSuggestions(true);
                    setHighlightedIndex(-1);
                    if (notReadyNotice) setNotReadyNotice(null);
                    if (claimedNotice) setClaimedNotice(null);
                    if (notFound) setNotFound(false);
                  }}
                  onFocus={() => {
                    if (query.trim().length >= 1) {
                      setShowSuggestions(true);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (showSuggestions && suggestions.length > 0) {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
                        return;
                      }
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
                        return;
                      }
                      if (event.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
                        event.preventDefault();
                        handleSelectSuggestion(suggestions[highlightedIndex]);
                        return;
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setShowSuggestions(false);
                        return;
                      }
                    }
                    if (event.key === "Enter") {
                      setShowSuggestions(false);
                      void handleSearch();
                    }
                  }}
                  className="h-10 pl-9 text-sm md:h-9 bg-background"
                />

                {/* Autocomplete Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    role="listbox"
                    aria-label="Suggested customers"
                    className="absolute top-full left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
                  >
                    <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Ready for Pickup ({suggestions.length})
                      </span>
                      <span className="hidden sm:inline text-[10px] text-muted-foreground">
                        Press ↑↓ to navigate, Enter to select
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-border/40 p-1">
                      {suggestions.map((item, index) => {
                        const isHighlighted = index === highlightedIndex;
                        return (
                          <button
                            key={item.id || item.ticketId}
                            type="button"
                            role="option"
                            aria-selected={isHighlighted}
                            onClick={() => handleSelectSuggestion(item)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer",
                              isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                                {item.customerName ? item.customerName.charAt(0).toUpperCase() : "?"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-foreground truncate">
                                    {highlightMatch(item.customerName, query)}
                                  </span>
                                  <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                                    #{item.ticketId}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
                                  <span>{item.washType || "Regular"}</span>
                                  <span>•</span>
                                  <span>₱{item.fee.toLocaleString()}</span>
                                  {item.dropOffDate && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate">{item.dropOffDate}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5">
                              <StatusBadge status={item.status} />
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-60" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setShowSuggestions(false);
                  void handleSearch();
                }}
                className="min-h-[44px] px-4 md:min-h-0"
                disabled={loading}
              >
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
                  Ticket #{claimedNotice} has already been claimed and released. It is disposed from active verification but remains in your records and Verification History below.
                </p>
              </div>
            )}

            {notReadyNotice && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-sm text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-amber-600 dark:text-amber-400" />
                <p className="font-semibold">Order Not Ready for Pickup</p>
                <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">
                  Ticket #{notReadyNotice.ticketId} ({notReadyNotice.customerName}) is currently in &quot;{notReadyNotice.status}&quot; stage. Only orders marked as &quot;Ready&quot; can be verified and released for pickup.
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
                      {result.eta ? formatReadableDateTime(result.eta) : "Awaiting estimate"}
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
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 font-medium sm:min-h-0 sm:flex-none transition-colors cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                          onClick={() => void handleClaim()}
                          disabled={submitting}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Confirm Claim &amp; Release
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
          <CardTitle className="text-sm font-semibold">Verification History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border md:hidden">
            {logs.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No verification activity recorded yet.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="space-y-3 p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                        {log.ticketId}
                      </span>
                      <p className="truncate text-sm font-medium text-foreground">{log.customerName || "-"}</p>
                      <p className="text-xs text-muted-foreground">{formatReadableDateTime(log.dateTime) || log.dateTime}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", actionBadgeColor(log.action))}>
                        {log.action}
                      </span>
                      {log.isPending && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving…
                        </span>
                      )}
                      {log.isUnsaved && (
                        <span className="inline-flex items-center rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                          Unsaved
                        </span>
                      )}
                    </div>
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
              ))
            )}
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
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No verification activity recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/80 hover:bg-muted/40 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">{formatReadableDateTime(log.dateTime) || log.dateTime}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          {log.staff}
                          {log.isPending && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-normal">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving…
                            </span>
                          )}
                          {log.isUnsaved && (
                            <span className="inline-flex items-center text-[10px] text-destructive font-normal">
                              (Unsaved)
                            </span>
                          )}
                        </span>
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
                  ))
                )}
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
