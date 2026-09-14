"use client";

import { useState, useMemo } from "react";
import {
  ArrowRight,
  Plus,
  Receipt,
  Droplet,
  CheckCircle2,
  Banknote,
  ListTodo,
  Sparkles,
  UserPlus,
  Users,
  Package,
  Inbox,
  RotateCw,
  Wind,
} from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  transactions as initialTransactions,
  loyaltyMembers as initialLoyaltyMembers,
  type Transaction,
} from "@/lib/data";
import { TransactionDetailModal } from "@/components/transaction-detail-modal";
import type { Page } from "@/components/sidebar";
import { useLoyaltyMembers } from "@/hooks/use-loyalty-members";
import { loadBusinessProfile, loadLoyaltySettings } from "@/lib/settings-store";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

interface DashboardPageProps {
  transactions?: Transaction[];
  loyaltyEnabled?: boolean;
  role?: "admin" | "staff";
  onNavigate?: (page: Page) => void;
}

export default function DashboardPage({
  transactions = initialTransactions,
  loyaltyEnabled = true,
  role = "admin",
  onNavigate,
}: DashboardPageProps) {
  const { members: liveMembers } = useLoyaltyMembers();
  const businessProfile = useMemo(() => loadBusinessProfile(), []);
  const loyaltyConfig = useMemo(() => loadLoyaltySettings(), []);
  const isLoyaltyOn = typeof loyaltyEnabled === "boolean" ? loyaltyEnabled : loyaltyConfig.enabled;

  // Modal State
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (txn: Transaction) => {
    setSelectedTxn(txn);
    setDetailOpen(true);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent, page: Page) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onNavigate?.(page);
    }
  };

  // Counts & Metrics
  const totalOrders = transactions.length;
  const receivedCount = transactions.filter((t) => t.status === "Received").length;
  const washingCount = transactions.filter((t) => t.status === "Washing").length;
  const dryingCount = transactions.filter((t) => t.status === "Drying").length;
  const readyCount = transactions.filter((t) => t.status === "Ready").length;
  const activeOrdersCount = receivedCount + washingCount + dryingCount + readyCount;

  const paidRevenue = transactions
    .filter((t) => t.paymentStatus === "paid" && t.status !== "Voided")
    .reduce((sum, t) => sum + t.fee, 0);

  const totalMembers = liveMembers.length > 0 ? liveMembers.length : initialLoyaltyMembers.length;

  // Donut chart calculations (Active Pipeline)
  const chartTotal = Math.max(1, activeOrdersCount);
  const receivedPct = (receivedCount / chartTotal) * 100;
  const washingPct = (washingCount / chartTotal) * 100;
  const dryingPct = (dryingCount / chartTotal) * 100;
  const readyPct = (readyCount / chartTotal) * 100;

  // SVG Donut circumference (radius = 38, circumference ≈ 238.76)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeReceived = (receivedPct / 100) * circumference;
  const strokeWashing = (washingPct / 100) * circumference;
  const strokeDrying = (dryingPct / 100) * circumference;
  const strokeReady = (readyPct / 100) * circumference;

  const offsetReceived = 0;
  const offsetWashing = -strokeReceived;
  const offsetDrying = -(strokeReceived + strokeWashing);
  const offsetReady = -(strokeReceived + strokeWashing + strokeDrying);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-primary">{businessProfile.shopName || "Sunshine Laundry Shop"}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Today at a glance — {businessProfile.shopName || "Sunshine Laundry Shop"}
          </p>
        </div>
        {onNavigate && (
          <Button
            onClick={() => onNavigate("new-transaction")}
            className="gap-2 shrink-0 w-full sm:w-auto shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New order
          </Button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TOP STAT CARDS (Original Info with FreshSpin Color Scheme & Icons) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className={cn(
        "grid grid-cols-1 sm:grid-cols-2 gap-3.5",
        isLoyaltyOn ? "md:grid-cols-3 lg:grid-cols-5" : "md:grid-cols-2 lg:grid-cols-4"
      )}>
        {/* 1. Today's Orders */}
        <Card className="border border-border/70 rounded-2xl shadow-xs bg-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">
                  Today&apos;s Orders
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {totalOrders}
                </p>
                <p className="text-xs text-muted-foreground">orders this cycle</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#F6F1F9] dark:bg-purple-950/40 border border-purple-100/80 dark:border-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                <Receipt className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. In Progress */}
        <Card className="border border-border/70 rounded-2xl shadow-xs bg-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">
                  In Progress
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {washingCount}
                </p>
                <p className="text-xs text-muted-foreground">currently washing</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#F6F1F9] dark:bg-purple-950/40 border border-purple-100/80 dark:border-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                <Droplet className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Ready for Pickup */}
        <Card className="border border-border/70 rounded-2xl shadow-xs bg-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">
                  Ready for Pickup
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {readyCount}
                </p>
                <p className="text-xs text-muted-foreground">waiting for customers</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#F6F1F9] dark:bg-purple-950/40 border border-purple-100/80 dark:border-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                <Sparkles className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Revenue */}
        <Card className="border border-border/70 rounded-2xl shadow-xs bg-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">
                  Revenue
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                  ₱{paidRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">paid transactions</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#F6F1F9] dark:bg-purple-950/40 border border-purple-100/80 dark:border-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                <Banknote className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. Loyalty Members — Only rendered when loyalty is enabled */}
        {isLoyaltyOn && (
          <Card className="border border-border/70 rounded-2xl shadow-xs bg-card">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Loyalty Members
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {totalMembers}
                  </p>
                  <p className="text-xs text-muted-foreground">registered members</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-[#F6F1F9] dark:bg-purple-950/40 border border-purple-100/80 dark:border-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                  <Users className="w-5 h-5" aria-hidden="true" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>


      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MAIN TWO COLUMNS: Recent Orders (2 cols) & Orders by Stage (1 col) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Recent Orders Table */}
        <div className="lg:col-span-2">
          <Card className="border border-border shadow-none h-full flex flex-col">
            <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between pb-3">
              <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate("processing")}
                  className="text-xs font-medium text-primary hover:underline rounded-md px-2 py-1 -my-1 -mr-2 min-h-[44px] inline-flex items-center gap-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  View board <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="border-y border-border bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold">
                    <th scope="col" className="text-left px-4 py-3">Ticket</th>
                    <th scope="col" className="text-left px-3 py-3">Customer</th>
                    <th scope="col" className="text-left px-3 py-3">Service</th>
                    <th scope="col" className="text-left px-3 py-3">Status</th>
                    <th scope="col" className="text-right px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.slice(0, 6).map((txn) => (
                    <tr
                      key={txn.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetail(txn)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail(txn);
                        }
                      }}
                      className="hover:bg-muted/20 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary transition-colors cursor-pointer group"
                      aria-label={`View order #${txn.ticketId} for ${txn.customerName}`}
                    >
                      <td className="px-4 py-3.5 font-medium text-primary group-hover:underline tabular-nums">
                        #{txn.ticketId}
                      </td>
                      <td className="px-3 py-3.5 font-medium text-foreground max-w-[140px] sm:max-w-[200px] truncate">
                        {txn.customerName}
                      </td>
                      <td className="px-3 py-3.5 text-muted-foreground truncate">
                        {txn.washType || "Regular"}
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusBadge status={txn.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-foreground tabular-nums">
                        ₱{txn.fee.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No orders recorded yet today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Orders by Stage Donut Chart */}
        <div>
          <Card className="border border-border shadow-none h-full flex flex-col justify-between p-4 sm:p-5 gap-3 sm:gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Orders by Stage</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Where today&apos;s laundry sits right now
                </p>
              </div>
              {onNavigate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate("processing")}
                  className="text-xs text-primary hover:bg-primary/10 gap-1 h-7 px-2 cursor-pointer font-medium"
                >
                  View board <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Donut graphic */}
            <div className="relative my-2 flex items-center justify-center">
              <svg
                className="w-36 h-36 -rotate-90"
                viewBox="0 0 100 100"
                role="img"
                aria-label={`Order distribution: ${receivedCount} received, ${washingCount} washing, ${dryingCount} drying, ${readyCount} ready`}
              >
                {/* Background Track */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-muted/20"
                />
                {/* Received Segment (Purple) */}
                {receivedCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="10"
                    strokeDasharray={`${strokeReceived} ${circumference}`}
                    strokeDashoffset={offsetReceived}
                    strokeLinecap="round"
                  />
                )}
                {/* Washing Segment (Blue) */}
                {washingCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="10"
                    strokeDasharray={`${strokeWashing} ${circumference}`}
                    strokeDashoffset={offsetWashing}
                    strokeLinecap="round"
                  />
                )}
                {/* Drying Segment (Amber) */}
                {dryingCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="10"
                    strokeDasharray={`${strokeDrying} ${circumference}`}
                    strokeDashoffset={offsetDrying}
                    strokeLinecap="round"
                  />
                )}
                {/* Ready Segment (Emerald) */}
                {readyCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="10"
                    strokeDasharray={`${strokeReady} ${circumference}`}
                    strokeDashoffset={offsetReady}
                    strokeLinecap="round"
                  />
                )}
              </svg>

              {/* Center text */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {activeOrdersCount}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  In Pipeline
                </span>
              </div>
            </div>

            {/* Stage Summary 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Received */}
              <div
                role={onNavigate ? "button" : undefined}
                tabIndex={onNavigate ? 0 : undefined}
                onClick={() => onNavigate?.("processing")}
                onKeyDown={(e) => onNavigate && handleCardKeyDown(e, "processing")}
                className="group rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 p-2.5 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Inbox className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-foreground font-semibold block truncate">Received</span>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {activeOrdersCount > 0 ? `${Math.round(receivedPct)}%` : "0%"}
                    </span>
                  </div>
                </div>
                <span className="text-base font-bold text-foreground tabular-nums shrink-0 ml-1">
                  {receivedCount}
                </span>
              </div>

              {/* Washing */}
              <div
                role={onNavigate ? "button" : undefined}
                tabIndex={onNavigate ? 0 : undefined}
                onClick={() => onNavigate?.("processing")}
                onKeyDown={(e) => onNavigate && handleCardKeyDown(e, "processing")}
                className="group rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 p-2.5 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-foreground font-semibold block truncate">Washing</span>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {activeOrdersCount > 0 ? `${Math.round(washingPct)}%` : "0%"}
                    </span>
                  </div>
                </div>
                <span className="text-base font-bold text-foreground tabular-nums shrink-0 ml-1">
                  {washingCount}
                </span>
              </div>

              {/* Drying */}
              <div
                role={onNavigate ? "button" : undefined}
                tabIndex={onNavigate ? 0 : undefined}
                onClick={() => onNavigate?.("processing")}
                onKeyDown={(e) => onNavigate && handleCardKeyDown(e, "processing")}
                className="group rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 p-2.5 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Wind className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-foreground font-semibold block truncate">Drying</span>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {activeOrdersCount > 0 ? `${Math.round(dryingPct)}%` : "0%"}
                    </span>
                  </div>
                </div>
                <span className="text-base font-bold text-foreground tabular-nums shrink-0 ml-1">
                  {dryingCount}
                </span>
              </div>

              {/* Ready */}
              <div
                role={onNavigate ? "button" : undefined}
                tabIndex={onNavigate ? 0 : undefined}
                onClick={() => onNavigate?.("processing")}
                onKeyDown={(e) => onNavigate && handleCardKeyDown(e, "processing")}
                className="group rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 p-2.5 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-foreground font-semibold block truncate">Ready</span>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {activeOrdersCount > 0 ? `${Math.round(readyPct)}%` : "0%"}
                    </span>
                  </div>
                </div>
                <span className="text-base font-bold text-foreground tabular-nums shrink-0 ml-1">
                  {readyCount}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <TransactionDetailModal
          transaction={selectedTxn}
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setSelectedTxn(null);
          }}
          loyaltyEnabled={isLoyaltyOn}
        />
      )}
    </div>
  );
}
