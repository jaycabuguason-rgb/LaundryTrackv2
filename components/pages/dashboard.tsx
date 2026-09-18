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
  QrCode,
  Layers,
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
import { formatReadableDateTime } from "@/lib/date-format";

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

  // Counts & Metrics (3 Operational Stages: Received -> Washing -> Ready)
  const totalOrders = transactions.length;
  const receivedCount = transactions.filter((t) => t.status === "Received").length;
  const washingCount = transactions.filter((t) => t.status === "Washing" || t.status === "Drying").length;
  const readyCount = transactions.filter((t) => t.status === "Ready").length;
  const activeOrdersCount = receivedCount + washingCount + readyCount;

  const paidRevenue = transactions
    .filter((t) => t.paymentStatus === "paid" && t.status !== "Voided")
    .reduce((sum, t) => sum + t.fee, 0);

  const totalMembers = liveMembers.length > 0 ? liveMembers.length : initialLoyaltyMembers.length;

  // Donut chart calculations (Active Pipeline: Received -> Washing -> Ready)
  const chartTotal = Math.max(1, activeOrdersCount);
  const receivedPct = (receivedCount / chartTotal) * 100;
  const washingPct = (washingCount / chartTotal) * 100;
  const readyPct = (readyCount / chartTotal) * 100;

  // SVG Donut circumference (radius = 38, circumference ≈ 238.76)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeReceived = (receivedPct / 100) * circumference;
  const strokeWashing = (washingPct / 100) * circumference;
  const strokeReady = (readyPct / 100) * circumference;

  const offsetReceived = 0;
  const offsetWashing = -strokeReceived;
  const offsetReady = -(strokeReceived + strokeWashing);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* HEADER: Responsive (Mobile Concept & Desktop) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Desktop Header */}
        <div className="hidden sm:flex sm:items-center sm:justify-between">
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
              className="gap-2 shrink-0 shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New order
            </Button>
          )}
        </div>

        {/* Mobile Header (matches mobile concept reference) */}
        <div className="flex items-center justify-between sm:hidden">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">Today at a glance</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-xs font-bold" aria-hidden="true">
                ✨
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              Live operational summary for {businessProfile.shopName || "Sunshine Laundry"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/60 dark:bg-muted/30 px-2.5 py-1 rounded-full shadow-xs shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-foreground">Live Sync</span>
          </div>
        </div>

        {/* Mobile Quick Action Buttons: Scan QR + Intake Order */}
        {onNavigate && (
          <div className="grid grid-cols-2 gap-2.5 sm:hidden mt-0.5">
            <button
              type="button"
              onClick={() => onNavigate("claim-verification")}
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-card border border-border/70 shadow-xs active:scale-[0.98] transition-transform text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="w-9 h-9 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-foreground truncate">Scan QR</span>
                <span className="block text-[10px] text-muted-foreground truncate">Instant pickup</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("new-transaction")}
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-primary text-primary-foreground shadow-xs active:scale-[0.98] transition-transform text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-primary-foreground truncate">Intake Order</span>
                <span className="block text-[10px] text-primary-foreground/80 truncate">Fast counter</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* OPERATIONAL METRICS: Swipeable Carousel on Mobile, Responsive Grid on Desktop */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between sm:hidden px-0.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Operational Metrics
          </span>
          <span className="text-xs text-primary font-medium">
            Swipe for more →
          </span>
        </div>

        <div className={cn(
          "flex sm:grid overflow-x-auto sm:overflow-visible no-scrollbar snap-x snap-mandatory gap-3 pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0",
          isLoyaltyOn ? "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-4"
        )}>
          {/* 1. Today's Orders */}
          <Card className="snap-start shrink-0 w-[164px] sm:w-auto border border-border/70 rounded-2xl shadow-xs bg-card">
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
          <Card className="snap-start shrink-0 w-[164px] sm:w-auto border border-border/70 rounded-2xl shadow-xs bg-card">
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
          <Card className="snap-start shrink-0 w-[164px] sm:w-auto border border-border/70 rounded-2xl shadow-xs bg-card">
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
          <Card className="snap-start shrink-0 w-[164px] sm:w-auto border border-border/70 rounded-2xl shadow-xs bg-card">
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
            <Card className="snap-start shrink-0 w-[164px] sm:w-auto border border-border/70 rounded-2xl shadow-xs bg-card">
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
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MAIN CONTENT: Orders by Stage & Recent Orders */}
      {/* On mobile: Orders by Stage is on top (order-1), Recent Orders below (order-2) */}
      {/* On desktop: Recent Orders 2 cols (lg:order-1), Orders by Stage 1 col (lg:order-2) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Orders by Stage Card */}
        <div className="order-1 lg:order-2">
          <Card className="border border-border/70 rounded-2xl shadow-xs h-full flex flex-col justify-between p-4 sm:p-5 gap-3 sm:gap-4 bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100/80 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Orders by Stage</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeOrdersCount} Active in wash line
                  </p>
                </div>
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

            {/* Donut graphic + Stage Summary (Responsive layout) */}
            <div className="flex flex-col sm:flex-col items-center justify-center gap-4 my-1">
              {/* Donut graphic */}
              <div className="relative flex items-center justify-center shrink-0">
                <svg
                  className="w-36 h-36 -rotate-90"
                  viewBox="0 0 100 100"
                  role="img"
                  aria-label={`Order distribution: ${receivedCount} received, ${washingCount} washing, ${readyCount} ready`}
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
                    Active
                  </span>
                </div>
              </div>

              {/* Stage Summary 3-Column Bento Grid (Option 3) */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full">
                {/* Received */}
                <div
                  role={onNavigate ? "button" : undefined}
                  tabIndex={onNavigate ? 0 : undefined}
                  onClick={() => onNavigate?.("processing")}
                  onKeyDown={(e) => onNavigate && handleCardKeyDown(e, "processing")}
                  className="group rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 p-2 sm:p-2.5 transition-all cursor-pointer flex flex-col justify-between items-center text-center space-y-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" aria-hidden="true" />
                    <span className="text-xs text-foreground font-semibold truncate">Received</span>
                  </div>
                  <span className="text-lg sm:text-xl font-bold text-foreground tabular-nums leading-tight">
                    {receivedCount}
                  </span>
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                    {activeOrdersCount > 0 ? `${Math.round(receivedPct)}%` : "0%"}
                  </span>
                </div>

                {/* Washing */}
                <div
                  role={onNavigate ? "button" : undefined}
                  tabIndex={onNavigate ? 0 : undefined}
                  onClick={() => onNavigate?.("processing")}
                  onKeyDown={(e) => onNavigate && handleCardKeyDown(e, "processing")}
                  className="group rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 p-2 sm:p-2.5 transition-all cursor-pointer flex flex-col justify-between items-center text-center space-y-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
                    <span className="text-xs text-foreground font-semibold truncate">Washing</span>
                  </div>
                  <span className="text-lg sm:text-xl font-bold text-foreground tabular-nums leading-tight">
                    {washingCount}
                  </span>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                    {activeOrdersCount > 0 ? `${Math.round(washingPct)}%` : "0%"}
                  </span>
                </div>

                {/* Ready */}
                <div
                  role={onNavigate ? "button" : undefined}
                  tabIndex={onNavigate ? 0 : undefined}
                  onClick={() => onNavigate?.("processing")}
                  onKeyDown={(e) => onNavigate && handleCardKeyDown(e, "processing")}
                  className="group rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 p-2 sm:p-2.5 transition-all cursor-pointer flex flex-col justify-between items-center text-center space-y-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                    <span className="text-xs text-foreground font-semibold truncate">Ready</span>
                  </div>
                  <span className="text-lg sm:text-xl font-bold text-foreground tabular-nums leading-tight">
                    {readyCount}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {activeOrdersCount > 0 ? `${Math.round(readyPct)}%` : "0%"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Orders: 2 cols on desktop, Mobile cards on mobile */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <Card className="border border-border/70 rounded-2xl shadow-xs h-full flex flex-col bg-card">
            <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between pb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Latest intake &amp; dispatch queue
                </p>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate("processing")}
                  className="text-xs font-medium text-primary hover:underline rounded-md px-2 py-1 -my-1 -mr-2 min-h-[44px] inline-flex items-center gap-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  View all <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </CardHeader>
            <CardContent className="p-4 sm:p-0 flex-1">
              {/* Mobile View: High-touch Card List matching reference */}
              <div className="sm:hidden space-y-2.5">
                {transactions.slice(0, 6).map((txn) => (
                  <div
                    key={`mobile-${txn.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetail(txn)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetail(txn);
                      }
                    }}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border/70 hover:bg-muted/20 active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
                    aria-label={`Order #${txn.ticketId} details for ${txn.customerName}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-[#F6F1F9] dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 flex flex-col items-center justify-center shrink-0 border border-purple-100/80 dark:border-purple-900/30">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">TKT</span>
                        <span className="text-xs font-bold leading-tight tabular-nums">#{txn.ticketId}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-foreground truncate">{txn.customerName}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                            {txn.washType || "Regular"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          <span className="truncate">{formatReadableDateTime(txn.arrivalDateTime) || txn.arrivalDateTime || txn.dropOffDate}</span>
                          {typeof txn.weight === "number" && txn.weight > 0 && (
                            <>
                              <span>•</span>
                              <span className="tabular-nums">{txn.weight} kg</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={txn.status} />
                      <span className="text-xs font-bold text-foreground tabular-nums">
                        ₱{txn.fee.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/70">
                    No orders recorded yet today.
                  </div>
                )}
              </div>

              {/* Desktop View: Full Semantic Table */}
              <div className="hidden sm:block overflow-x-auto">
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
              </div>
            </CardContent>
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
