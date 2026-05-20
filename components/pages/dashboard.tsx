"use client";

import { useState } from "react";
import {
  ShoppingBag,
  AlertCircle,
  Loader2,
  Users,
  Eye,
  BarChart3,
  ArrowRight,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  transactions as initialTransactions,
  statusColors,
  loyaltyMembers,
  type Transaction,
} from "@/lib/data";
import { TransactionDetailModal } from "@/components/transaction-detail-modal";
import type { Page } from "@/components/sidebar";
import dynamic from "next/dynamic";
import { usePeakHours } from "@/hooks/usePeakHours";

const PeakHoursChart = dynamic(
  () => import("@/components/peak-hours-chart"),
  { ssr: false, loading: () => <div className="h-40 w-full animate-pulse bg-muted rounded-md" /> }
);

interface DashboardPageProps {
  transactions?: Transaction[];
  loyaltyEnabled?: boolean;
  role?: "admin" | "staff";
  onNavigate?: (page: Page) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardPage({
  transactions = initialTransactions,
  loyaltyEnabled = true,
  role = "admin",
  onNavigate,
}: DashboardPageProps) {
  const isStaff = role === "staff";
  const today = transactions[0]?.dropOffDate ?? initialTransactions[0]?.dropOffDate ?? "";
  const todayTransactions = transactions.filter((transaction) => transaction.dropOffDate === today);
  const totalRevenue = todayTransactions.reduce((sum, transaction) => sum + transaction.fee, 0);
  const readyForPickup = transactions.filter((transaction) => transaction.status === "Ready").length;
  const activeOrders = transactions.filter(
    (transaction) =>
      transaction.status === "Received" ||
      transaction.status === "Washing" ||
      transaction.status === "Drying",
  ).length;

  // Peak hours data from hook
  const { data: peakHoursData, loading: peakHoursLoading } = usePeakHours(transactions);

  const adminCards = [
    {
      label: "Total Transactions Today",
      value: todayTransactions.length,
      icon: ShoppingBag,
      color: "text-blue-600",
      bg: "bg-blue-50",
      change: "+3 from yesterday",
    },
    {
      label: "Total Revenue Today",
      value: formatCurrency(totalRevenue),
      icon: null,
      color: "text-green-600",
      bg: "bg-green-50",
      change: "+12% vs yesterday",
    },
    {
      label: "Ready for Pickup",
      value: readyForPickup,
      icon: AlertCircle,
      color: "text-orange-600",
      bg: "bg-orange-50",
      change: "Waiting to be claimed",
    },
    {
      label: "Active Orders",
      value: activeOrders,
      icon: Loader2,
      color: "text-purple-600",
      bg: "bg-purple-50",
      change: "In progress",
    },
  ];

  const cards = isStaff ? adminCards.filter((card) => card.label !== "Total Revenue Today") : adminCards;

  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (txn: Transaction) => {
    setSelectedTxn(txn);
    setDetailOpen(true);
  };

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 ${isStaff ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="border border-border shadow-none">
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-tight text-muted-foreground">{card.label}</p>
                      {card.label === "Total Revenue Today" ? (
                        <p className="mt-1 text-xl md:text-2xl text-foreground">
                          <span className="font-normal">₱</span>
                          <span className="font-bold">{String(card.value).replace(/[₱,]/g, '')}</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xl font-bold text-foreground md:text-2xl">{card.value}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{card.change}</p>
                    </div>
                    <div className={`ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg md:h-10 md:w-10 ${card.bg} dark:bg-opacity-20`}>
                      {Icon ? (
                        <Icon className={`h-4 w-4 md:h-5 md:w-5 ${card.color}`} />
                      ) : (
                        <span className={`text-base font-bold md:text-lg ${card.color}`}>₱</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className={`grid grid-cols-1 gap-4 ${!isStaff ? "lg:grid-cols-3" : ""}`}>
          <div className={!isStaff ? "lg:col-span-2" : ""}>
            <Card className="border border-border shadow-none">
              <CardHeader className="px-4 pb-3 pt-4 md:px-5 md:pt-5">
                <CardTitle className="text-sm font-semibold text-foreground">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead>
                      <tr className="border-y border-border bg-muted/40">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground md:px-5">Ticket ID</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Customer</th>
                        <th className="hidden px-3 py-2.5 text-left text-xs font-medium text-muted-foreground md:table-cell">Drop-off</th>
                        <th className="hidden px-3 py-2.5 text-left text-xs font-medium text-muted-foreground md:table-cell">Type</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                        <th className="px-3 py-2.5 pr-4 text-left text-xs font-medium text-muted-foreground md:pr-5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 6).map((txn) => (
                        <tr key={txn.id} className="border-b border-border last:border-0 transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3 md:px-5">
                            <button
                              onClick={() => openDetail(txn)}
                              className="cursor-pointer text-xs font-medium text-primary hover:underline"
                            >
                              {txn.ticketId}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-xs font-medium text-foreground">{txn.customerName}</td>
                          <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell">{txn.dropOffDate}</td>
                          <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell">{txn.washType}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[txn.status]}`}>
                              {txn.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 pr-4 md:pr-5">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`View details for ticket ${txn.ticketId}`}
                              className="h-8 w-8 min-h-[44px] min-w-[44px] md:h-7 md:min-h-0 md:min-w-0 md:w-7"
                              onClick={() => openDetail(txn)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {!isStaff && (
            <div className="space-y-4">
              <Card className="border border-border shadow-none">
                <CardHeader className="px-4 pb-2 pt-4 md:px-5 md:pt-5">
                  <CardTitle className="text-sm font-semibold text-foreground">Peak Hours Today</CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-4 md:px-3">
                  {peakHoursLoading ? (
                    <div className="flex h-40 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : peakHoursData.length === 0 || peakHoursData.every(d => d.count === 0) ? (
                    <div className="flex h-40 items-center justify-center">
                      <p className="text-xs text-muted-foreground">No transactions yet today</p>
                    </div>
                  ) : (
                    <PeakHoursChart data={peakHoursData} />
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border shadow-none">
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-50">
                      <Users className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground">Loyalty Members</p>
                        {!loyaltyEnabled && (
                          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-foreground">{loyaltyMembers.length}</p>
                      <p className="text-xs text-muted-foreground">
                        {loyaltyEnabled ? "Active enrolled members" : "Program currently off"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {onNavigate && (
                <Card className="border border-border shadow-none">
                  <CardHeader className="px-4 pb-2 pt-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Links</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 px-3 pb-3">
                    <button
                      onClick={() => onNavigate("reports")}
                      className="group flex w-full items-center justify-between rounded-md px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                        Reports &amp; Analytics
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                    <button
                      onClick={() => onNavigate("staff-management")}
                      className="group flex w-full items-center justify-between rounded-md px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        Staff Management
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      <TransactionDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        transaction={selectedTxn}
      />
    </>
  );
}
