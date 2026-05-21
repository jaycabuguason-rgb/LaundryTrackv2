"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  statusColors,
  type Transaction,
  type TransactionStatus,
} from "@/lib/data";
import { TransactionDetailModal } from "@/components/transaction-detail-modal";
import { StatusUpdateSheet } from "@/components/status-update-sheet";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessingPageProps {
  transactions: Transaction[];
  loading?: boolean;
  error?: string | null;
  onUpdateTransaction?: (ticketId: string, updates: { status: TransactionStatus }) => Promise<Transaction>;
  onViewTransaction?: (ticketId: string) => void;
  adminName?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: TransactionStatus[] = ["Received", "Washing", "Drying", "Ready"];

/** All statuses shown in the dropdown, in order */
const ALL_STATUS_OPTIONS: {
  status: TransactionStatus;
  label: string;
  dotClass: string;
}[] = [
  { status: "Received",   label: "Received",   dotClass: "bg-blue-500"   },
  { status: "Washing",    label: "Washing",     dotClass: "bg-yellow-500" },
  { status: "Drying",     label: "Drying",      dotClass: "bg-orange-500" },
  { status: "Ready",      label: "Ready",       dotClass: "bg-green-500"  },
  { status: "Claimed",    label: "Claimed",     dotClass: "bg-gray-500"   },
  { status: "Voided",     label: "Voided",      dotClass: "bg-red-500"    },
];

/** Statuses that require a confirmation dialog before applying */
const IRREVERSIBLE_STATUSES: TransactionStatus[] = ["Claimed", "Voided"];

const STAGE_BADGE_COLORS: Record<TransactionStatus, string> = {
  Received:   "bg-blue-100 text-blue-700 border-blue-200",
  Washing:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  Drying:     "bg-orange-100 text-orange-700 border-orange-200",
  Ready:      "bg-green-100 text-green-700 border-green-200",
  Claimed:    "bg-gray-100 text-gray-600 border-gray-200",
  Voided:     "bg-red-100 text-red-700 border-red-200",
};

const STAGE_CARD_ACCENT: Record<TransactionStatus, string> = {
  Received:   "border-blue-200",
  Washing:    "border-yellow-200",
  Drying:     "border-orange-200",
  Ready:      "border-green-200",
  Claimed:    "border-gray-200",
  Voided:     "border-red-200",
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

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastMsg { id: number; text: string; }

function ToastContainer({ toasts, onDismiss }: { toasts: ToastMsg[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
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
  adminName,
}: ProcessingPageProps) {
  const [expandedStage, setExpandedStage] = useState<TransactionStatus | null>(null);
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [tick, setTick] = useState(0); // force re-render for relative time
  const [updatingTicket, setUpdatingTicket] = useState<string | null>(null);
  const [sheetTxn, setSheetTxn] = useState<Transaction | null>(null);
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Active (non-claimed, non-voided) transactions
  const activeTransactions = useMemo(
    () => transactions.filter((t) => STAGES.includes(t.status)),
    [transactions],
  );

  // Grouped by stage
  const grouped = useMemo(
    () =>
      STAGES.map((stage) => ({
        stage,
        items: activeTransactions.filter((t) => t.status === stage),
      })),
    [activeTransactions],
  );

  // Filtered by search query (across all stages)
  const searchLower = search.trim().toLowerCase();
  const filteredGrouped = useMemo(
    () =>
      grouped.map(({ stage, items }) => ({
        stage,
        items: searchLower
          ? items.filter(
              (t) =>
                t.ticketId.toLowerCase().includes(searchLower) ||
                t.customerName.toLowerCase().includes(searchLower),
            )
          : items,
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

  const handleToggleStage = (stage: TransactionStatus) => {
    setExpandedStage((prev) => (prev === stage ? null : stage));
  };

  // Core update – called after any confirmation / immediate click
  const applyStatusUpdate = async (txn: Transaction, newStatus: TransactionStatus) => {
    if (!onUpdateTransaction) return;
    setUpdatingTicket(txn.ticketId);
    try {
      await onUpdateTransaction(txn.ticketId, { status: newStatus });
      setLastUpdated(new Date());
      pushToast(`${txn.ticketId} moved to ${newStatus}`);
      setSheetTxn(null);
      return true;
    } catch {
      pushToast("Unable to update the ticket status right now");
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
    setDetailTxn(txn);
    setDetailOpen(true);
    if (onViewTransaction) onViewTransaction(txn.ticketId);
  };

  // ─── Stage list table ──────────────────────────────────────────────────────

  const renderList = (stage: TransactionStatus, items: Transaction[]) => {
    return (
      <Card className="border border-border shadow-none">
        <CardHeader className="px-4 pb-3 pt-4 md:px-5 md:pt-5">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                STAGE_BADGE_COLORS[stage],
              )}
            >
              {stage}
            </span>
            <span className="text-muted-foreground font-normal">— {items.length} ticket{items.length !== 1 ? "s" : ""}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {items.length === 0 ? (
            <div className="px-4 pb-5 text-sm text-muted-foreground md:px-5">
              No tickets in this stage.
            </div>
          ) : (
            <>
            <div className="divide-y divide-border md:hidden">
              {items.map((txn) => {
                const hoursInStage = getHoursInStage(txn.arrivalDateTime);
                const isPriorityReady = stage === "Ready" && hoursInStage >= 2;
                const isUpdating = updatingTicket === txn.ticketId;
                return (
                  <div key={txn.id} className="space-y-3 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button
                          onClick={() => handleViewTicket(txn)}
                          className="text-xs font-mono font-semibold text-primary hover:underline cursor-pointer"
                          title="View ticket details"
                        >
                          {txn.ticketId}
                        </button>
                        <p className="truncate text-xs font-medium text-foreground">{txn.customerName}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{txn.arrivalDateTime}</p>
                      </div>
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap", statusColors[txn.status])}>
                        {txn.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-2.5">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Wash</p>
                        <p className="truncate text-xs font-medium text-foreground">{txn.washType}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Weight</p>
                        <p className="text-xs font-medium text-foreground">{txn.weight > 0 ? `${txn.weight} kg` : "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">In Stage</p>
                        <p className={cn("text-xs font-medium", getTimeInStageColor(txn.arrivalDateTime))}>{formatTimeInStage(txn.arrivalDateTime)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      {isPriorityReady ? (
                        <span className="inline-flex items-center rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                          Waiting {Math.floor(hoursInStage)}h
                        </span>
                      ) : <span />}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isUpdating}
                        className="h-8 gap-1.5 text-xs px-2.5"
                        onClick={() => setSheetTxn(txn)}
                      >
                        {isUpdating ? "Updating..." : "Update Status"}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground md:px-5">Ticket ID</th>
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
                    const isUpdating = updatingTicket === txn.ticketId;

                    return (
                      <tr
                        key={txn.id}
                        className={cn(
                          "border-b border-border last:border-0 transition-colors hover:bg-muted/20",
                          isPriorityReady && "border-l-2 border-l-orange-400",
                        )}
                      >
                        <td className="px-4 py-3 md:px-5">
                          <button
                            onClick={() => handleViewTicket(txn)}
                            className="font-mono text-xs font-semibold text-primary hover:underline cursor-pointer"
                            title="View ticket details"
                          >
                            {txn.ticketId}
                          </button>
                          {isPriorityReady && (
                            <span
                              className="ml-1.5 inline-block rounded bg-orange-100 px-1 py-0.5 text-[10px] font-semibold text-orange-700"
                              title={`Waiting for pickup for ${Math.floor(hoursInStage)} hrs`}
                            >
                              Waiting {Math.floor(hoursInStage)}h
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs font-medium text-foreground">{txn.customerName}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{txn.arrivalDateTime}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{txn.washType}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{txn.weight > 0 ? `${txn.weight} kg` : "—"}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">₱{txn.fee.toLocaleString()}</td>
                        <td className="px-3 py-3">
                          <span
                            className={cn("text-xs", getTimeInStageColor(txn.arrivalDateTime))}
                            title={`Drop-off: ${txn.arrivalDateTime}`}
                          >
                            {formatTimeInStage(txn.arrivalDateTime)}
                          </span>
                        </td>
                        <td className="px-3 py-3 pr-4 md:pr-5">
                          {/* Update Status dropdown — shows ALL statuses */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isUpdating}
                                className="h-7 gap-1.5 text-xs px-2.5 cursor-pointer"
                              >
                                {isUpdating ? "Updating…" : "Update Status"}
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[180px]">
                              {ALL_STATUS_OPTIONS.map(({ status, label, dotClass }) => {
                                const isCurrent = txn.status === status;
                                return (
                                  <DropdownMenuItem
                                    key={status}
                                    disabled={isCurrent}
                                    className={cn(
                                      "cursor-pointer text-xs gap-2",
                                      isCurrent && "opacity-50 cursor-default",
                                    )}
                                    onClick={() => !isCurrent && handleStatusSelect(txn, status)}
                                  >
                                    {/* Colored dot */}
                                    <span
                                      className={cn(
                                        "inline-flex h-2 w-2 shrink-0 rounded-full",
                                        dotClass,
                                        isCurrent && "ring-2 ring-offset-1 ring-current",
                                      )}
                                    />
                                    {/* Label */}
                                    <span className="flex-1">{label}</span>
                                    {/* Checkmark for current */}
                                    {isCurrent && (
                                      <Check className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
                                    )}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
        {/* Top row: total card + search + refresh */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Total Ongoing Transactions */}
          <Card className="border border-border shadow-none sm:min-w-[240px]">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <p className="text-sm font-medium text-muted-foreground">Total Ongoing Transactions</p>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
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
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
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
            {/* Stage cards — horizontal row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {filteredGrouped.map(({ stage, items }) => {
                const isOpen = expandedStage === stage;
                const allItems = grouped.find((g) => g.stage === stage)?.items ?? [];

                return (
                  <button
                    key={stage}
                    onClick={() => handleToggleStage(stage)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      isOpen
                        ? cn("border-2", STAGE_CARD_ACCENT[stage], "bg-muted/40")
                        : "border-border bg-card hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold text-foreground">{stage}</p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-bold",
                          STAGE_BADGE_COLORS[stage],
                        )}
                      >
                        {searchLower ? items.length : allItems.length}
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-foreground">
                      {searchLower ? items.length : allItems.length}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
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
              return renderList(group.stage, group.items);
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

      {/* Read-only ticket detail modal */}
      <TransactionDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        transaction={detailTxn}
      />

      {/* ── Irreversible-action confirmation dialog ─────────────────────────── */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog({ open: false, txn: null, targetStatus: null });
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.targetStatus === "Voided"
                ? `Void ${confirmDialog.txn?.ticketId}?`
                : `Mark ${confirmDialog.txn?.ticketId} as Claimed?`}
            </DialogTitle>
            <DialogDescription>
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, txn: null, targetStatus: null })}
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.targetStatus === "Voided" ? "destructive" : "default"}
              onClick={handleConfirmStatus}
            >
              Confirm
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
        currentStatus={sheetTxn?.status ?? "Received"}
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
