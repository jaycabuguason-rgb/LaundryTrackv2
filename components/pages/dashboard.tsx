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
  Package,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

  // Counts & Metrics
  const totalOrders = transactions.length;
  const receivedCount = transactions.filter((t) => t.status === "Received").length;
  const washingCount = transactions.filter((t) => t.status === "Washing" || t.status === "Drying").length;
  const readyCount = transactions.filter((t) => t.status === "Ready").length;
  const activeOrdersCount = transactions.filter(
    (t) => t.status === "Received" || t.status === "Washing" || t.status === "Drying" || t.status === "Ready"
  ).length;

  const paidRevenue = transactions
    .filter((t) => t.paymentStatus === "paid" && t.status !== "Voided")
    .reduce((sum, t) => sum + t.fee, 0);

  const totalMembers = liveMembers.length > 0 ? liveMembers.length : initialLoyaltyMembers.length;

  // New members enrolled in current month
  const currentMonthIdx = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthShort = new Date().toLocaleString("en-US", { month: "short" }).toUpperCase();
  const memberList = liveMembers.length > 0 ? liveMembers : initialLoyaltyMembers;
  const newMembersThisMonth = memberList.filter((m) => {
    if (!m.dateJoined) return false;
    const d = new Date(m.dateJoined);
    return d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear;
  }).length;
  const displayMembersCount = newMembersThisMonth > 0 ? newMembersThisMonth : (memberList.length > 0 ? memberList.length : 1);

  // Donut chart calculations
  const chartTotal = Math.max(1, receivedCount + washingCount + readyCount);
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
            className="gap-2 shrink-0 self-start sm:self-auto shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New order
          </Button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TOP STAT CARDS (FreshSpin Concept Layout) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* 1. Today's Revenue */}
        <Card
          onClick={() => onNavigate?.("transactions")}
          className="border border-border/70 rounded-2xl shadow-xs hover:border-primary/40 hover:shadow-md transition-all bg-card cursor-pointer group"
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Today&apos;s Revenue
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  ₱{paidRevenue.toLocaleString()}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-muted/70 dark:bg-muted/40 border border-border/40 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                <Banknote className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Active Orders */}
        <Card
          onClick={() => onNavigate?.("processing")}
          className="border border-border/70 rounded-2xl shadow-xs hover:border-primary/40 hover:shadow-md transition-all bg-card cursor-pointer group"
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Active Orders
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {activeOrdersCount}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-muted/70 dark:bg-muted/40 border border-border/40 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                <ListTodo className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Ready for Pickup */}
        <Card
          onClick={() => onNavigate?.("claim-verification")}
          className="border border-border/70 rounded-2xl shadow-xs hover:border-primary/40 hover:shadow-md transition-all bg-card cursor-pointer group"
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Ready for Pickup
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {readyCount}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-muted/70 dark:bg-muted/40 border border-border/40 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. New Members (or Total Orders if loyalty disabled) */}
        <Card
          onClick={() => onNavigate?.(isLoyaltyOn ? "loyalty" : "transactions")}
          className="border border-border/70 rounded-2xl shadow-xs hover:border-primary/40 hover:shadow-md transition-all bg-card cursor-pointer group"
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {isLoyaltyOn ? `New Members (${currentMonthShort})` : "Total Orders"}
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {isLoyaltyOn ? displayMembersCount : totalOrders}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-muted/70 dark:bg-muted/40 border border-border/40 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                {isLoyaltyOn ? <UserPlus className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MAIN TWO COLUMNS: Recent Orders (2 cols) & Orders by Stage (1 col) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Recent Orders Table */}
        <div className="lg:col-span-2">
          <Card className="border border-border shadow-none h-full flex flex-col">
            <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Recent Orders</CardTitle>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate("processing")}
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View board <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="border-y border-border bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold">
                    <th className="text-left px-4 py-3">Ticket</th>
                    <th className="text-left px-3 py-3">Customer</th>
                    <th className="text-left px-3 py-3">Service</th>
                    <th className="text-left px-3 py-3">Status</th>
                    <th className="text-right px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.slice(0, 6).map((txn) => (
                    <tr
                      key={txn.id}
                      onClick={() => openDetail(txn)}
                      className="hover:bg-muted/20 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 font-medium text-primary group-hover:underline">
                        #{txn.ticketId}
                      </td>
                      <td className="px-3 py-3 font-medium text-foreground">
                        {txn.customerName}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {txn.washType || "Regular"}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={txn.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
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
          <Card className="border border-border shadow-none h-full flex flex-col justify-between p-4 sm:p-5">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">Orders by Stage</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Where today&apos;s laundry sits right now
              </CardDescription>

              {/* Donut graphic */}
              <div className="relative my-6 flex items-center justify-center">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    className="text-muted/30"
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
                  {/* Ready Segment (Green) */}
                  {readyCount > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="10"
                      strokeDasharray={`${strokeReady} ${circumference}`}
                      strokeDashoffset={offsetReady}
                      strokeLinecap="round"
                    />
                  )}
                </svg>

                {/* Center text */}
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold tracking-tight text-foreground">{totalOrders}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Total Orders
                  </span>
                </div>
              </div>
            </div>

            {/* Stage Summary Mini-Boxes */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {/* Received */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-2.5 text-center flex flex-col items-center justify-center">
                <div className="w-6 h-6 rounded-md bg-purple-500/10 text-purple-500 flex items-center justify-center mb-1">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-bold text-foreground">{receivedCount}</span>
                <span className="text-[10px] text-muted-foreground font-medium">Received</span>
              </div>

              {/* Washing */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5 text-center flex flex-col items-center justify-center">
                <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center mb-1">
                  <Droplet className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-bold text-foreground">{washingCount}</span>
                <span className="text-[10px] text-muted-foreground font-medium">Washing</span>
              </div>

              {/* Ready */}
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-2.5 text-center flex flex-col items-center justify-center">
                <div className="w-6 h-6 rounded-md bg-green-500/10 text-green-500 flex items-center justify-center mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-bold text-foreground">{readyCount}</span>
                <span className="text-[10px] text-muted-foreground font-medium">Ready</span>
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
        />
      )}
    </div>
  );
}
