"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Droplet,
  Inbox,
  Loader2,
  PackageCheck,
  RefreshCw,
  RotateCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  type Transaction,
  type TransactionStatus,
} from "@/lib/data";
import { StatusUpdateSheet } from "@/components/status-update-sheet";
import { STATUS_ICONS, StatusBadge } from "@/components/status-badge";
import { formatReadableDateTime } from "@/lib/date-format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessingPageProps {
  transactions: Transaction[];
  loading?: boolean;
  error?: string | null;
  onUpdateTransaction?: (ticketId: string, updates: { status: TransactionStatus }) => Promise<{ transaction: Transaction; loyaltyResult?: import("@/lib/transaction-contracts").StampAwardResult }>;
  onViewTransaction?: (ticketId: string) => void;
  onEditTransaction?: (ticketId: string) => void;
  onNavigate?: (page: import("@/components/sidebar").Page) => void;
  adminName?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export type ProcessingStageId = "Received" | "Washed" | "Ready";

interface ProcessingStageConfig {
  id: ProcessingStageId;
  label: string;
  statuses: TransactionStatus[];
  badgeColor: string;
  accent: string;
}

const STAGES: ProcessingStageConfig[] = [
  {
    id: "Received",
    label: "Received",
    statuses: ["Received"],
    badgeColor: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
    accent: "border-purple-300 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800",
  },
  {
    id: "Washed",
    label: "Washing",
    statuses: ["Washing", "Drying"],
    badgeColor: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
    accent: "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800",
  },
  {
    id: "Ready",
    label: "Ready",
    statuses: ["Ready"],
    badgeColor: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300",
    accent: "border-green-300 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800",
  },
];

/** 3 active processing statuses shown in the quick stage workflow */
const ALL_STATUS_OPTIONS: {
  status: TransactionStatus;
  label: string;
}[] = [
  { status: "Received", label: "Received" },
  { status: "Washing",  label: "Washing" },
  { status: "Ready",    label: "Ready" },
];

/** All actionable statuses available for batch update */
const BULK_STATUS_OPTIONS: {
  status: TransactionStatus;
  label: string;
}[] = [
  { status: "Received", label: "Received" },
  { status: "Washing",  label: "Washing" },
  { status: "Ready",    label: "Ready" },
];

/** Statuses that require a confirmation dialog before applying */
const IRREVERSIBLE_STATUSES: TransactionStatus[] = ["Claimed", "Voided"];

const STAGE_BADGE_COLORS: Record<TransactionStatus, string> = {
  Received:   "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  Washing:    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  Drying:     "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  Ready:      "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  Claimed:    "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
  Voided:     "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300",
};

const STAGE_CARD_ACCENT: Record<TransactionStatus, string> = {
  Received:   "border-purple-300 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800",
  Washing:    "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800",
  Drying:     "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800",
  Ready:      "border-green-300 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800",
  Claimed:    "border-gray-300 bg-gray-50/50 dark:bg-gray-900/20 dark:border-gray-700",
  Voided:     "border-red-300 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeInStage(arrivalDateTime: string): string {
  const arrival = new Date(arrivalDateTime);
  if (isNaN(arrival.getTime())) return "—";
  const diffMs = Date.now() - arrival.getTime();
  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 1) return "Just now";
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  if (days > 0 && hours > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours} hr${hours > 1 ? "s" : ""}`;
  return `${mins} min`;
}

function getTimeInStageColor(arrivalDateTime: string): string {
  const arrival = new Date(arrivalDateTime);
  if (isNaN(arrival.getTime())) return "text-muted-foreground";
  const diffHours = (Date.now() - arrival.getTime()) / (1000 * 60 * 60);
  if (diffHours < 2) return "text-green-600 font-medium";
  if (diffHours < 4) return "text-yellow-600 font-medium";
  return "text-red-600 font-semibold";
}

function getHoursInStage(arrivalDateTime: string): number {
  const arrival = new Date(arrivalDateTime);
  if (isNaN(arrival.getTime())) return 0;
  return (Date.now() - arrival.getTime()) / (1000 * 60 * 60);
}

function formatLastUpdated(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec} sec ago`;
  const mins = Math.floor(diffSec / 60);
  return `${mins} min ago`;
}

function getNextStageAction(status: TransactionStatus): { nextStatus: TransactionStatus; label: string; shortLabel: string } | null {
  if (status === "Received") {
    return { nextStatus: "Washing", label: "Start Wash →", shortLabel: "Wash →" };
  }
  if (status === "Washing" || status === "Drying") {
    return { nextStatus: "Ready", label: "Mark Ready ✓", shortLabel: "Ready ✓" };
  }
  // Ready stage tickets are claimed via Claim Verification page
  return null;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastMsg { id: number; text: string; }

function ToastContainer({ toasts, onDismiss }: { toasts: ToastMsg[]; onDismiss: (id: number) => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none lg:bottom-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 rounded-lg border border-border bg-popover px-4 py-3 text-sm font-medium text-popover-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2"
        >
          <Check className="h-4 w-4 shrink-0 text-green-500" />
          {t.text}
          <button
            onClick={() => onDismiss(t.id)}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProcessingPage({
  transactions,
  loading = false,
  error = null,
  onUpdateTransaction,
  onViewTransaction,
  onEditTransaction: _onEditTransaction,
  onNavigate: _onNavigate,
  adminName,
}: ProcessingPageProps) {
  const [expandedStage, setExpandedStage] = useState<ProcessingStageId | null>("Received");
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [tick, setTick] = useState(0); // force re-render for relative time
  const [updatingTicket, setUpdatingTicket] = useState<string | null>(null);
  const [sheetTxn, setSheetTxn] = useState<Transaction | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Multi-select state ──────────────────────────────────────────────────────
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState<boolean>(false);
  const [bulkConfirmDialog, setBulkConfirmDialog] = useState<{
    open: boolean;
    targetStatus: TransactionStatus | null;
    ticketIds: string[];
  }>({ open: false, targetStatus: null, ticketIds: [] });

  // ── Confirmation dialog state ──────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    txn: Transaction | null;
    targetStatus: TransactionStatus | null;
  }>({ open: false, txn: null, targetStatus: null });

  // ── Toast state ───────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastIdRef = useRef(0);

  const pushToast = useCallback((text: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Active (non-claimed, non-voided) transactions: Received, Washing, Drying, Ready
  const activeTransactions = useMemo(
    () => transactions.filter((t) => ["Received", "Washing", "Drying", "Ready"].includes(t.status)),
    [transactions],
  );

  // Grouped by simplified 3 operational stages
  const grouped = useMemo(
    () =>
      STAGES.map((s) => ({
        stage: s.id,
        label: s.label,
        badgeColor: s.badgeColor,
        accent: s.accent,
        items: activeTransactions.filter((t) => s.statuses.includes(t.status)),
      })),
    [activeTransactions],
  );

  // Filtered by search query (across all stages)
  const searchLower = search.trim().toLowerCase();
  const filteredGrouped = useMemo(
    () =>
      grouped.map((g) => ({
        ...g,
        items: searchLower
          ? g.items.filter(
              (t) =>
                t.ticketId.toLowerCase().includes(searchLower) ||
                t.customerName.toLowerCase().includes(searchLower),
            )
          : g.items,
      })),
    [grouped, searchLower],
  );

  // Auto-refresh every 30 seconds
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      setLastUpdated(new Date());
      setTick((n) => n + 1);
    }, 30000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, []);

  // Update relative time display every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = useCallback(() => {
    setLastUpdated(new Date());
    setTick((n) => n + 1);
  }, []);

  const handleToggleStage = (stage: ProcessingStageId) => {
    setExpandedStage((prev) => (prev === stage ? null : stage));
  };

  // ── Multi-select handlers ──────────────────────────────────────────────────
  const handleToggleSelectTicket = (ticketId: string) => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  const handleSelectAllInStage = (items: Transaction[]) => {
    const stageTicketIds = items.map((t) => t.ticketId);
    const allSelected = stageTicketIds.length > 0 && stageTicketIds.every((id) => selectedTicketIds.has(id));

    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all in this stage
        stageTicketIds.forEach((id) => next.delete(id));
      } else {
        // Select all in this stage
        stageTicketIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedTicketIds(new Set());
  };

  // Core bulk update execution
  const executeBulkStatusUpdate = async (ticketIds: string[], targetStatus: TransactionStatus) => {
    if (!onUpdateTransaction || ticketIds.length === 0) return;
    setIsBulkUpdating(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process updates concurrently with Promise.allSettled
      const results = await Promise.allSettled(
        ticketIds.map((ticketId) => onUpdateTransaction(ticketId, { status: targetStatus }))
      );

      results.forEach((res) => {
        if (res.status === "fulfilled") {
          successCount++;
        } else {
          failCount++;
        }
      });

      setLastUpdated(new Date());

      if (successCount > 0) {
        pushToast(
          `Updated ${successCount} ticket${successCount > 1 ? "s" : ""} to ${targetStatus}${
            failCount > 0 ? ` (${failCount} failed)` : ""
          }`
        );
      } else {
        pushToast("Failed to update the selected tickets. Please try again.");
      }

      // Remove successfully updated tickets from selection
      setSelectedTicketIds((prev) => {
        const next = new Set(prev);
        ticketIds.forEach((id) => next.delete(id));
        return next;
      });
    } catch {
      pushToast("An error occurred during bulk status update.");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Called when user selects a target status for bulk update
  const handleBulkStatusSelect = (targetStatus: TransactionStatus) => {
    const validIds = Array.from(selectedTicketIds);
    if (validIds.length === 0) return;

    if (IRREVERSIBLE_STATUSES.includes(targetStatus)) {
      setBulkConfirmDialog({
        open: true,
        targetStatus,
        ticketIds: validIds,
      });
      return;
    }

    executeBulkStatusUpdate(validIds, targetStatus);
  };

  // Confirm bulk irreversible dialog
  const handleConfirmBulkStatus = async () => {
    const { targetStatus, ticketIds } = bulkConfirmDialog;
    setBulkConfirmDialog({ open: false, targetStatus: null, ticketIds: [] });
    if (targetStatus && ticketIds.length > 0) {
      await executeBulkStatusUpdate(ticketIds, targetStatus);
    }
  };

  // Core update – called after any confirmation / immediate click
  const applyStatusUpdate = async (txn: Transaction, newStatus: TransactionStatus) => {
    if (!onUpdateTransaction) return;
    if (updatingTicket === txn.ticketId) return; // Prevent duplicate in-flight requests for same ticket
    setUpdatingTicket(txn.ticketId);
    setSheetTxn(null);

    try {
      const res = await onUpdateTransaction(txn.ticketId, { status: newStatus });
      setLastUpdated(new Date());
      pushToast(`${txn.ticketId} moved to ${newStatus}`);
      if (res.loyaltyResult?.stamped && res.loyaltyResult.rewarded) {
        pushToast(`Reward Unlocked! Customer earned a free wash! They now have ${res.loyaltyResult.newStampCount} stamps.`);
      } else if (res.loyaltyResult?.stamped) {
        pushToast(`Stamp Added! Customer now has ${res.loyaltyResult.newStampCount} stamps.`);
      }
      return true;
    } catch {
      pushToast("Unable to update the ticket status right now — reverted.");
      return false;
    } finally {
      setUpdatingTicket(null);
    }
  };

  // Called when user clicks a status option in the dropdown
  const handleStatusSelect = (txn: Transaction, newStatus: TransactionStatus) => {
    if (newStatus === txn.status) return; // already active — no-op

    if (IRREVERSIBLE_STATUSES.includes(newStatus)) {
      setConfirmDialog({ open: true, txn, targetStatus: newStatus });
      return;
    }

    applyStatusUpdate(txn, newStatus);
  };

  // Confirm button inside the dialog
  const handleConfirmStatus = async () => {
    const { txn, targetStatus } = confirmDialog;
    setConfirmDialog({ open: false, txn: null, targetStatus: null });
    if (txn && targetStatus) {
      await applyStatusUpdate(txn, targetStatus);
    }
  };

  const handleViewTicket = (txn: Transaction) => {
    if (onViewTransaction) onViewTransaction(txn.ticketId);
  };

  // ─── Stage list table ──────────────────────────────────────────────────────

  const renderList = (stage: ProcessingStageId, label: string, badgeColor: string, items: Transaction[]) => {
    const stageTicketIds = items.map((t) => t.ticketId);
    const selectedCountInStage = stageTicketIds.filter((id) => selectedTicketIds.has(id)).length;
    const isAllInStageSelected = items.length > 0 && selectedCountInStage === items.length;
    const isSomeInStageSelected = selectedCountInStage > 0 && !isAllInStageSelected;

    return (
      <Card className="border border-border shadow-none">
        <CardHeader className="px-4 pb-3 pt-4 md:px-5 md:pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  badgeColor,
                )}
              >
                {label}
              </span>
              <span className="text-muted-foreground font-normal">— {items.length} ticket{items.length !== 1 ? "s" : ""}</span>
            </CardTitle>

            {items.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectAllInStage(items)}
                  className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer px-2"
                >
                  {isAllInStageSelected ? "Deselect All in Stage" : "Select All in Stage"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {items.length === 0 ? (
            <div className="px-4 pb-5 text-sm text-muted-foreground md:px-5">
              No tickets in this stage.
            </div>
          ) : (
            <>
            {/* Mobile View: High-fidelity Cards matching Stitch concept reference */}
            <div className="space-y-3 p-3 md:hidden">
              {/* Mobile sub-toolbar: Select All in Stage */}
              <div className="flex items-center justify-between pb-1 px-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={isAllInStageSelected ? true : isSomeInStageSelected ? "indeterminate" : false}
                    onCheckedChange={() => handleSelectAllInStage(items)}
                    aria-label="Select all tickets in this stage"
                    className="cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Select All in Stage ({items.length})
                  </span>
                </label>
                <span className="text-xs text-muted-foreground font-medium">
                  {stage}
                </span>
              </div>

              {items.map((txn) => {
                const hoursInStage = getHoursInStage(txn.arrivalDateTime);
                const isPriorityReady = stage === "Ready" && hoursInStage >= 2;
                const isLongWaiting = !isPriorityReady && hoursInStage >= 4;
                const isUpdating = updatingTicket === txn.ticketId;
                const nextAction = getNextStageAction(txn.status);
                const isSelected = selectedTicketIds.has(txn.ticketId);
                const StatusIcon = STATUS_ICONS[txn.status] || Droplet;

                return (
                  <div
                    key={txn.id}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs transition-all active:scale-[0.99] flex flex-col gap-3",
                      isSelected && "bg-primary/5 dark:bg-primary/10 border-primary/40",
                    )}
                  >
                    {/* Left vertical accent border */}
                    <div
                      className={cn(
                        "absolute left-0 top-0 bottom-0 w-1.5",
                        stage === "Received"
                          ? "bg-purple-600"
                          : stage === "Washed"
                          ? "bg-blue-600"
                          : "bg-emerald-600",
                        isLongWaiting && "bg-amber-500",
                        hoursInStage >= 24 && "bg-red-500",
                      )}
                    />

                    {/* Top Row: Checkbox, Ticket ID, Wash Type, Time badge */}
                    <div className="flex items-center justify-between pl-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelectTicket(txn.ticketId)}
                          aria-label={`Select ticket ${txn.ticketId}`}
                          className="cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => handleViewTicket(txn)}
                          className="font-mono text-xs font-bold text-primary hover:underline cursor-pointer tracking-tight"
                          title="View ticket details"
                        >
                          #{txn.ticketId}
                        </button>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-medium truncate">
                          {txn.washType || "Regular"}
                        </span>
                      </div>

                      {/* Urgency or Time in Stage Pill */}
                      {isPriorityReady ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                          <AlertTriangle className="w-3 h-3" />
                          Waiting {Math.floor(hoursInStage)}h
                        </span>
                      ) : isLongWaiting ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-bold animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          {Math.floor(hoursInStage)}h in stage
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {formatTimeInStage(txn.arrivalDateTime)}
                        </span>
                      )}
                    </div>

                    {/* Middle Row: Customer name, Weight, Date-time, Fee & Payment */}
                    <div className="flex items-center justify-between pl-1 py-0.5">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-foreground truncate">
                          {txn.customerName}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>{txn.weight > 0 ? `${txn.weight} kg` : "—"}</span>
                          <span>•</span>
                          <span className="truncate">{formatReadableDateTime(txn.arrivalDateTime) || txn.arrivalDateTime || txn.dropOffDate}</span>
                        </span>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-sm font-bold text-foreground tabular-nums">
                          ₱{txn.fee.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground capitalize">
                          {txn.paymentStatus}
                        </span>
                      </div>
                    </div>

                    {/* Action Bottom Row: Stage indicator, More options, 1-Click action button */}
                    <div className="flex items-center justify-between gap-2 pt-1 pl-1 border-t border-border/40">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <StatusIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">Stage: {txn.status}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUpdating}
                          className="h-9 w-9 p-0 rounded-xl cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSheetTxn(txn);
                          }}
                          aria-label="More status options"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>

                        {nextAction && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isUpdating}
                            aria-label={nextAction.shortLabel}
                            className="h-9 px-3.5 rounded-xl gap-1.5 text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusSelect(txn, nextAction.nextStatus);
                            }}
                          >
                            {isUpdating ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Saving…</span>
                              </>
                            ) : (
                              <span>{nextAction.label}</span>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/40">
                    <th className="w-10 px-4 py-2.5 text-left md:px-5">
                      <div className="flex items-center">
                        <Checkbox
                          checked={isAllInStageSelected ? true : isSomeInStageSelected ? "indeterminate" : false}
                          onCheckedChange={() => handleSelectAllInStage(items)}
                          aria-label="Select all tickets in this stage"
                          className="cursor-pointer"
                        />
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Ticket ID</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Customer</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Drop-off</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Wash Type</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Weight</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Fee</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Time in Stage</th>
                    <th className="px-3 py-2.5 pr-4 text-left text-xs font-medium text-muted-foreground md:pr-5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((txn) => {
                    const hoursInStage = getHoursInStage(txn.arrivalDateTime);
                    const isPriorityReady = stage === "Ready" && hoursInStage >= 2;
                    const isLongWaiting = !isPriorityReady && hoursInStage >= 4;
                    const isUpdating = updatingTicket === txn.ticketId;
                    const nextAction = getNextStageAction(txn.status);
                    const isSelected = selectedTicketIds.has(txn.ticketId);

                    return (
                      <tr
                        key={txn.id}
                        className={cn(
                          "border-b border-border last:border-0 transition-colors hover:bg-muted/20",
                          isSelected && "bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15",
                          isPriorityReady && "border-l-2 border-l-amber-400",
                          isLongWaiting && "border-l-2 border-l-amber-500/50",
                        )}
                      >
                        <td className="w-10 px-4 py-3 md:px-5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelectTicket(txn.ticketId)}
                            aria-label={`Select ticket ${txn.ticketId}`}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => handleViewTicket(txn)}
                            className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary hover:underline cursor-pointer"
                            title="View ticket details"
                          >
                            {txn.ticketId}
                          </button>
                          {isPriorityReady && (
                            <span
                              className="ml-1.5 inline-block rounded bg-amber-100 px-1 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                              title={`Waiting for pickup for ${Math.floor(hoursInStage)} hrs`}
                            >
                              Waiting {Math.floor(hoursInStage)}h
                            </span>
                          )}
                          {isLongWaiting && (
                            <span
                              className="ml-1.5 inline-block rounded bg-amber-500/10 px-1 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
                              title={`In stage for ${Math.floor(hoursInStage)} hrs`}
                            >
                              {Math.floor(hoursInStage)}h
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs font-medium text-foreground">{txn.customerName}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatReadableDateTime(txn.arrivalDateTime) || txn.arrivalDateTime}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{txn.washType}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{txn.weight > 0 ? `${txn.weight} kg` : "—"}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">₱{txn.fee.toLocaleString()}</td>
                        <td className="px-3 py-3">
                          <span
                            className={cn("text-xs", getTimeInStageColor(txn.arrivalDateTime))}
                            title={`Drop-off: ${formatReadableDateTime(txn.arrivalDateTime) || txn.arrivalDateTime}`}
                          >
                            {formatTimeInStage(txn.arrivalDateTime)}
                          </span>
                        </td>
                        <td className="px-3 py-3 pr-4 md:pr-5">
                          <div className="flex items-center gap-1.5">
                            {nextAction && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={isUpdating}
                                className="h-8 gap-1 text-xs px-3 rounded-xl font-medium cursor-pointer shadow-xs whitespace-nowrap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusSelect(txn, nextAction.nextStatus);
                                }}
                              >
                                {isUpdating ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Saving…</span>
                                  </>
                                ) : (
                                  nextAction.label
                                )}
                              </Button>
                            )}

                            {/* Update Status dropdown — shows ALL statuses */}
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isUpdating}
                                  className="h-8 w-8 p-0 rounded-xl border-border/80 hover:bg-muted/50 cursor-pointer shadow-xs"
                                  aria-label="More status options"
                                  title="More status options"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[200px] rounded-2xl border-border/60 bg-card p-1.5 shadow-xl">
                                {ALL_STATUS_OPTIONS.map(({ status, label }) => {
                                  const isCurrent = txn.status === status || (status === "Washing" && txn.status === "Drying");
                                  const StatusIcon = STATUS_ICONS[status];
                                  return (
                                    <DropdownMenuItem
                                      key={status}
                                      disabled={isCurrent}
                                      className={cn(
                                        "cursor-pointer rounded-xl px-3 py-2.5 mb-1 last:mb-0 transition-all duration-150 outline-none border",
                                        isCurrent
                                          ? "bg-primary/10 border-primary/20 text-primary font-semibold cursor-default"
                                          : "border-transparent text-foreground hover:bg-muted/50 hover:border-border/40 focus:bg-muted/50",
                                      )}
                                      onSelect={() => {
                                        if (!isCurrent) handleStatusSelect(txn, status);
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isCurrent) handleStatusSelect(txn, status);
                                      }}
                                    >
                                      <div className="flex items-center gap-3 w-full">
                                        <StatusIcon className={cn("w-4 h-4 shrink-0", isCurrent ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                                        <span className={cn("text-sm flex-1", isCurrent ? "font-semibold text-primary" : "font-medium text-foreground")}>{label}</span>
                                        {isCurrent && (
                                          <div className="flex items-center gap-1 pl-2">
                                            <span className="text-xs font-bold text-primary uppercase tracking-wider">Current</span>
                                            <Check className="w-3.5 h-3.5 text-primary" />
                                          </div>
                                        )}
                                      </div>
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-4 md:space-y-5">
        {/* Desktop Top row: total card + search + refresh */}
        <div className="hidden md:flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Total Ongoing Transactions */}
          <Card className="border border-border/80 bg-card shadow-xs sm:min-w-[240px]">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <p className="text-sm font-medium text-muted-foreground">Total Ongoing Transactions</p>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary tabular-nums">
                {activeTransactions.length}
              </span>
            </CardContent>
          </Card>

          {/* Search + refresh */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID or customer…"
                className="pl-8 h-9 text-sm w-full sm:w-56"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Last updated: {formatLastUpdated(lastUpdated)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                className="h-9 gap-1.5 text-xs cursor-pointer"
                aria-label="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile View Context & Header (matches concept design) */}
        <div className="md:hidden flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-xl font-extrabold tracking-tight text-foreground">Processing Pipeline</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                Total Ongoing Transactions: <strong className="text-foreground font-bold tabular-nums">{activeTransactions.length}</strong>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              className="h-8 gap-1 rounded-full text-xs font-semibold px-3 cursor-pointer shadow-xs"
              aria-label="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{formatLastUpdated(lastUpdated)}</span>
            </Button>
          </div>

          {/* Mobile Stage Filter Tabs (Segmented Control) */}
          <div className="bg-muted/50 p-1 rounded-2xl flex items-center gap-1 shadow-xs border border-border/50" role="tablist">
            {STAGES.map((s) => {
              const isActive = expandedStage === s.id;
              const allItems = grouped.find((g) => g.stage === s.id)?.items ?? [];
              const count = searchLower ? (filteredGrouped.find((g) => g.stage === s.id)?.items ?? []).length : allItems.length;
              const Icon = s.id === "Received" ? Inbox : s.id === "Washed" ? RotateCw : CheckCircle2;

              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setExpandedStage(s.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all text-center cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{s.label}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-tight tabular-nums",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mobile Search input */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID or customer…"
              className="pl-9 pr-9 h-11 text-sm w-full rounded-xl bg-card border-border/70 shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <Card className="border border-border shadow-none">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Loading transactions…
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stage cards — 3 operational process stages (Desktop) */}
            <div className="hidden md:grid grid-cols-1 gap-3 sm:grid-cols-3">
              {filteredGrouped.map(({ stage, label, badgeColor, accent, items }) => {
                const isOpen = expandedStage === stage;
                const allItems = grouped.find((g) => g.stage === stage)?.items ?? [];

                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => handleToggleStage(stage)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer",
                      isOpen
                        ? cn("border-2 shadow-xs", accent)
                        : "border-border/80 bg-card hover:bg-muted/30 shadow-xs",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold text-foreground">{label}</p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold",
                          badgeColor,
                        )}
                      >
                        {searchLower ? items.length : allItems.length}
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-foreground">
                      {searchLower ? items.length : allItems.length}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                      {isOpen ? "Hide list" : "View list"}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Expanded list */}
            {expandedStage && (() => {
              const group = filteredGrouped.find((g) => g.stage === expandedStage);
              if (!group) return null;
              return renderList(group.stage, group.label, group.badgeColor, group.items);
            })()}

            {/* Empty overall */}
            {activeTransactions.length === 0 && (
              <Card className="border border-border shadow-none">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No ongoing transactions.
                </CardContent>
              </Card>
            )}

            {/* No search results */}
            {searchLower &&
              filteredGrouped.every((g) => g.items.length === 0) && (
                <Card className="border border-border shadow-none">
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    No tickets match &ldquo;{search}&rdquo;.
                  </CardContent>
                </Card>
              )}
          </>
        )}
      </div>

      {/* ── Floating Bulk Action Bar ─────────────────────────────────────────── */}
      {selectedTicketIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-popover/95 px-4 py-3 text-popover-foreground shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {selectedTicketIds.size}
              </span>
              <span className="text-xs font-semibold sm:text-sm">
                ticket{selectedTicketIds.size > 1 ? "s" : ""} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick advance button based on active stage */}
              {expandedStage === "Received" && (
                <Button
                  type="button"
                  size="sm"
                  disabled={isBulkUpdating}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBulkStatusSelect("Washing");
                  }}
                  className="h-8 gap-1.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {isBulkUpdating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Start Wash ({selectedTicketIds.size})
                </Button>
              )}

              {expandedStage === "Washed" && (
                <Button
                  type="button"
                  size="sm"
                  disabled={isBulkUpdating}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBulkStatusSelect("Ready");
                  }}
                  className="h-8 gap-1.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {isBulkUpdating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Mark Ready ({selectedTicketIds.size})
                </Button>
              )}

              {/* Status picker dropdown for any target status */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBulkUpdating}
                    className="h-8 gap-1.5 rounded-xl text-xs font-medium cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Change Status</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[190px] rounded-2xl border-border/60 bg-card p-1.5 shadow-xl">
                  {BULK_STATUS_OPTIONS.map(({ status, label }) => {
                    const StatusIcon = STATUS_ICONS[status];
                    return (
                      <DropdownMenuItem
                        key={status}
                        onSelect={() => handleBulkStatusSelect(status)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBulkStatusSelect(status);
                        }}
                        className="cursor-pointer rounded-xl px-3 py-2 text-xs font-medium focus:bg-muted/60"
                      >
                        <div className="flex items-center gap-2.5 w-full">
                          <StatusIcon className="h-4 w-4 text-muted-foreground" />
                          <span>Move to {label}</span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Clear Selection */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBulkUpdating}
                onClick={handleClearSelection}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk irreversible-action confirmation dialog ─────────────────────── */}
      <Dialog
        open={bulkConfirmDialog.open}
        onOpenChange={(open) => {
          if (!open) setBulkConfirmDialog({ open: false, targetStatus: null, ticketIds: [] });
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-xl sm:max-w-md">
          <DialogHeader className="gap-2">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  bulkConfirmDialog.targetStatus === "Voided"
                    ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                    : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                )}
              >
                {bulkConfirmDialog.targetStatus === "Voided" ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <PackageCheck className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  Update {bulkConfirmDialog.ticketIds.length} tickets to {bulkConfirmDialog.targetStatus}?
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  This action cannot be undone. All selected tickets will be set to {bulkConfirmDialog.targetStatus}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="my-2 rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Selected count:</span>
              <span className="font-semibold text-foreground">{bulkConfirmDialog.ticketIds.length} tickets</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Status:</span>
              <span className="font-semibold text-foreground">{bulkConfirmDialog.targetStatus}</span>
            </div>
            <div className="mt-2 text-muted-foreground break-all text-[11px]">
              {bulkConfirmDialog.ticketIds.join(", ")}
            </div>
          </div>

          <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2.5">
            <Button
              variant="outline"
              className="rounded-xl border-border/80 text-xs font-medium cursor-pointer"
              onClick={() => setBulkConfirmDialog({ open: false, targetStatus: null, ticketIds: [] })}
            >
              Cancel
            </Button>
            <Button
              variant={bulkConfirmDialog.targetStatus === "Voided" ? "destructive" : "default"}
              className="rounded-xl text-xs font-medium cursor-pointer shadow-xs"
              onClick={handleConfirmBulkStatus}
            >
              Confirm Update ({bulkConfirmDialog.ticketIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ── Irreversible-action confirmation dialog ─────────────────────────── */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog({ open: false, txn: null, targetStatus: null });
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-xl sm:max-w-md">
          <DialogHeader className="gap-2">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  confirmDialog.targetStatus === "Voided"
                    ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                    : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                )}
              >
                {confirmDialog.targetStatus === "Voided" ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <PackageCheck className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  {confirmDialog.targetStatus === "Voided"
                    ? `Void Ticket ${confirmDialog.txn?.ticketId}?`
                    : `Mark ${confirmDialog.txn?.ticketId} as Claimed?`}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  This action is irreversible. Please confirm to proceed.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {confirmDialog.txn && (
            <div className="my-2 rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-semibold text-foreground">{confirmDialog.txn.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service:</span>
                <span className="font-medium text-foreground">{confirmDialog.txn.washType} ({confirmDialog.txn.weight > 0 ? `${confirmDialog.txn.weight} kg` : "—"})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Status:</span>
                <span className="font-medium text-foreground">{confirmDialog.txn.status}</span>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2.5">
            <Button
              variant="outline"
              className="rounded-xl border-border/80 text-xs font-medium cursor-pointer"
              onClick={() => setConfirmDialog({ open: false, txn: null, targetStatus: null })}
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.targetStatus === "Voided" ? "destructive" : "default"}
              className="rounded-xl text-xs font-medium cursor-pointer shadow-xs"
              onClick={handleConfirmStatus}
            >
              Confirm {confirmDialog.targetStatus}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toast notifications ─────────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <StatusUpdateSheet
        open={!!sheetTxn}
        onOpenChange={(open) => !open && setSheetTxn(null)}
        ticketId={sheetTxn?.ticketId}
        currentStatus={sheetTxn?.status === "Drying" ? "Washing" : (sheetTxn?.status ?? "Received")}
        options={ALL_STATUS_OPTIONS}
        disabled={Boolean(sheetTxn && updatingTicket === sheetTxn.ticketId)}
        onSelectStatus={async (status) => {
          if (!sheetTxn) return;
          handleStatusSelect(sheetTxn, status);
        }}
      />
    </>
  );
}
