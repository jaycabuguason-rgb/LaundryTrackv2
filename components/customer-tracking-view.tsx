"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Check,
  Copy,
  Inbox,
  RotateCw,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  User,
  Clock,
  Receipt,
  FileText,
  Calendar,
  Store,
  type LucideIcon,
} from "lucide-react";

import { formatReadableDateTime } from "@/lib/date-format";
import { StatusBadge } from "@/components/status-badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PublicTrackingRecord } from "@/lib/transaction-contracts";
import type { TransactionStatus } from "@/lib/data";
import { cn } from "@/lib/utils";

interface TrackingStep {
  id: "Received" | "Washing" | "Ready" | "Claimed";
  label: string;
  icon: LucideIcon;
  subtext: string;
}

const TRACKING_STEPS: readonly TrackingStep[] = [
  {
    id: "Received",
    label: "Received",
    icon: Inbox,
    subtext: "Logged & queued",
  },
  {
    id: "Washing",
    label: "Washing",
    icon: RotateCw,
    subtext: "In drum cycle",
  },
  {
    id: "Ready",
    label: "Ready",
    icon: ShoppingBag,
    subtext: "At counter",
  },
  {
    id: "Claimed",
    label: "Claimed",
    icon: CheckCircle2,
    subtext: "Handed over",
  },
] as const;

function getTrackingProgressIndex(status: string): number {
  if (status === "Claimed") return 3;
  if (status === "Ready") return 2;
  if (status === "Washing" || status === "Drying") return 1;
  return 0; // Received
}

export function StatusStepper({ status, dropOffTime }: { status: string; dropOffTime?: string }) {
  const activeIndex = getTrackingProgressIndex(status);

  if (status === "Voided") {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium">
        This order was cancelled and voided. Please contact the shop for assistance.
      </div>
    );
  }

  // Progress fill percentage (0% for step 0, 33% for step 1, 66% for step 2, 100% for step 3)
  const progressPercent = activeIndex === 0 ? "0%" : activeIndex === 1 ? "33%" : activeIndex === 2 ? "66%" : "100%";

  return (
    <div className="relative px-1 pt-1 pb-1">
      {/* Horizontal background track */}
      <div className="absolute left-6 right-6 top-5 h-1 bg-muted rounded-full -z-0" />
      {/* Dynamic progress bar */}
      <div
        className="absolute left-6 top-5 h-1 bg-primary rounded-full transition-all duration-500 -z-0"
        style={{ width: progressPercent }}
      />

      <div className="flex items-start justify-between relative z-10">
        {TRACKING_STEPS.map((step, index) => {
          const completed = index < activeIndex || status === "Claimed";
          const current = index === activeIndex && status !== "Claimed";
          const StepIcon = step.icon;

          return (
            <div key={step.id} className="flex flex-col items-center text-center w-20 sm:w-24">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-xs text-xs font-bold",
                  completed
                    ? "bg-primary text-white"
                    : current
                      ? "bg-purple-700 text-white ring-4 ring-purple-100 dark:ring-purple-900/50 shadow-sm"
                      : "bg-muted text-muted-foreground border border-border"
                )}
                aria-label={`${step.label} stage: ${completed ? "completed" : current ? "in progress" : "pending"}`}
              >
                {completed ? (
                  <Check className="w-4 h-4 text-white" />
                ) : current ? (
                  <StepIcon
                    className={cn(
                      "w-4 h-4 text-white",
                      step.id === "Washing" && "animate-spin",
                    )}
                  />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-xs mt-1.5 leading-tight font-bold",
                  current
                    ? "text-primary"
                    : completed
                      ? "text-foreground"
                      : "text-muted-foreground font-medium",
                )}
              >
                {step.label}
              </span>
              <span className="text-[10px] text-muted-foreground truncate max-w-full mt-0.5">
                {step.id === "Received" && dropOffTime ? dropOffTime.split(",")[1]?.trim() || step.subtext : step.subtext}
              </span>
              {current && (
                <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded-full mt-0.5 animate-pulse">
                  In Progress
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ACTIVE_TRACKING_STATUSES = ["Received", "Washing", "Drying", "Ready"];

export interface CustomerTrackingViewProps {
  initialRecord: PublicTrackingRecord;
  token: string;
  pickupQrUrl: string;
}

export function CustomerTrackingView({
  initialRecord,
  token,
  pickupQrUrl,
}: CustomerTrackingViewProps) {
  const [status, setStatus] = useState<TransactionStatus>(initialRecord.status);
  const [eta, setEta] = useState<string | null>(initialRecord.eta);
  const [lastSynced, setLastSynced] = useState<Date>(() => new Date());
  const [isPulsing, setIsPulsing] = useState(false);
  const [copied, setCopied] = useState(false);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const isActive = ACTIVE_TRACKING_STATUSES.includes(status);
  const isPaid = initialRecord.paymentStatus === "paid";

  // Trigger brief visual cue on live status update
  const notifyUpdated = () => {
    setLastSynced(new Date());
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 1200);
  };

  const handleCopyToken = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  // 1. Supabase Realtime Subscription (Zero reload, instant push)
  useEffect(() => {
    if (!isActive) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channelName = `public:tracking:${initialRecord.ticketId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
          filter: `ticket_id=eq.${initialRecord.ticketId}`,
        },
        (payload: { new?: { status?: string; eta?: string | null } }) => {
          const newStatus = payload.new?.status;
          if (newStatus && typeof newStatus === "string" && newStatus !== statusRef.current) {
            setStatus(newStatus as TransactionStatus);
            notifyUpdated();
          }
          if (payload.new?.eta !== undefined) {
            setEta(payload.new.eta);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [isActive, initialRecord.ticketId]);

  // 2. Resilient Lightweight JSON Poll (5-8s fallback, visibility-aware, zero reload)
  useEffect(() => {
    if (!isActive) return;

    const checkStatus = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        const response = await fetch(`/api/track/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = await response.json();
        if (data?.status && data.status !== statusRef.current) {
          setStatus(data.status as TransactionStatus);
          notifyUpdated();
        }
        if (data?.eta !== undefined) {
          setEta(data.eta);
        }
        setLastSynced(new Date());
      } catch {
        // Silently tolerate connection hiccups
      }
    };

    const intervalId = setInterval(checkStatus, 6000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive, token]);

  return (
    <div className="space-y-4">
      {/* ── 1. MAIN TICKET OVERVIEW CARD (Royal Freshness Concept) ────────── */}
      <section
        className={cn(
          "bg-white rounded-3xl p-4 sm:p-5 shadow-[0_10px_30px_rgba(11,28,48,0.06)] border border-border/70 relative transition-all duration-300 overflow-hidden",
          isPulsing && "ring-2 ring-primary/40",
        )}
        data-purpose="ticket-summary-card"
      >
        {/* Drawer/Card Header Bar */}
        <div className="flex items-center justify-between pb-3.5 border-b border-border/50 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-bold text-base text-foreground tracking-tight truncate">
                Ticket Details
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-700 text-white font-mono text-xs font-bold tracking-wide shrink-0 shadow-xs">
                {initialRecord.ticketId}
              </span>
            </div>
          </div>
          <StatusBadge status={status} className="px-3 py-1 text-xs font-semibold shadow-xs shrink-0" />
        </div>

        {/* Current Stage & Quick Payment Banner */}
        <div className="mt-3.5 w-full bg-[#F6F1F9] dark:bg-purple-950/40 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between border border-purple-100/80 dark:border-purple-900/40 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
              {status === "Washing" || status === "Drying" ? (
                <RotateCw className="w-5 h-5 animate-spin" style={{ animationDuration: "9s" }} />
              ) : status === "Ready" ? (
                <Sparkles className="w-5 h-5" />
              ) : status === "Claimed" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Inbox className="w-5 h-5" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Current Stage
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-200/70 dark:bg-purple-800 text-purple-900 dark:text-purple-100 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-700 dark:bg-purple-300" />
                  {status}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-foreground truncate mt-0.5">
                {status === "Washing" || status === "Drying"
                  ? "Machine Processing • Active Cycle"
                  : status === "Ready"
                    ? "Drying Complete • Awaiting Pickup"
                    : status === "Claimed"
                      ? "Order Handed Over to Customer"
                      : "Intake Checked • Ready for Wash"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end shrink-0 pl-2">
            <span className="text-[10px] text-muted-foreground font-medium">Payment</span>
            {isPaid ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold mt-0.5 shadow-xs border border-emerald-200/70 dark:border-emerald-800/40">
                <Check className="w-3 h-3" /> Paid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[11px] font-bold mt-0.5 shadow-xs border border-rose-200/70 dark:border-rose-800/40">
                Unpaid • ₱{initialRecord.balanceDue}
              </span>
            )}
          </div>
        </div>

        {/* 4-Step Status Progress Timeline */}
        <div className="mt-4 pt-3.5 border-t border-border/40" data-purpose="status-timeline-widget">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                STATUS TIMELINE
              </span>
            </div>
            <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">
              Step {Math.max(1, getTrackingProgressIndex(status) + 1)} of 4
            </span>
          </div>

          <StatusStepper status={status} dropOffTime={initialRecord.dropOffTime} />

          {/* Sync Status Line */}
          {isActive ? (
            <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live tracking active</span>
              <span>•</span>
              <span className="tabular-nums">
                Synced {lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
              </span>
            </div>
          ) : (
            <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Order completed</span>
            </div>
          )}
        </div>

        {/* Contextual Status Alerts */}
        {status === "Ready" && (
          <div className="mt-4 p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200/90 flex items-start gap-3 animate-in fade-in duration-300" data-purpose="ready-pickup-alert">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-950">Your Laundry is Ready for Pickup!</h3>
              <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                All items are washed and neatly packaged. Present your ticket ID or QR pass at the shop counter to claim.
              </p>
            </div>
          </div>
        )}

        {(status === "Washing" || status === "Drying") && (
          <div className="mt-4 p-3.5 bg-sky-50/80 rounded-2xl border border-sky-200/90 flex items-start gap-3 animate-in fade-in duration-300">
            <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <RotateCw className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-sky-950">Your Laundry is Being Washed!</h3>
              <p className="text-[11px] text-sky-800 leading-relaxed mt-0.5">
                Our team is currently running the wash and dry cycle for your clothes.
              </p>
            </div>
          </div>
        )}

        {status === "Received" && (
          <div className="mt-4 p-3.5 bg-purple-50/80 rounded-2xl border border-purple-200/90 flex items-start gap-3 animate-in fade-in duration-300">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-purple-950">Order Received & Queued</h3>
              <p className="text-[11px] text-purple-800 leading-relaxed mt-0.5">
                Your laundry has been received and will be scheduled for washing shortly.
              </p>
            </div>
          </div>
        )}

        {/* ── Order Breakdown 2-Column Grid (from code.html) ────────────────── */}
        <div className="mt-4 pt-3.5 border-t border-border/40 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-xs font-bold text-foreground">Order Breakdown</h3>
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
              Standard Drop-off
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {/* Customer */}
            <div className="bg-[#eff4ff]/60 dark:bg-muted/30 rounded-xl p-2.5 flex flex-col justify-between border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                Customer
              </span>
              <div className="mt-1">
                <div className="text-xs sm:text-sm font-bold text-foreground truncate">
                  {initialRecord.customerName || "Customer"}
                </div>
                {initialRecord.customerPhone && (
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {initialRecord.customerPhone}
                  </span>
                )}
              </div>
            </div>

            {/* Drop-off Time */}
            <div className="bg-[#eff4ff]/60 dark:bg-muted/30 rounded-xl p-2.5 flex flex-col justify-between border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                Drop-off Time
              </span>
              <div className="mt-1">
                <div className="text-xs sm:text-sm font-bold text-foreground truncate">
                  {initialRecord.dropOffTime ? initialRecord.dropOffTime.split(",")[0] : "Recorded"}
                </div>
                <span className="text-[11px] text-muted-foreground block truncate">
                  {initialRecord.dropOffTime ? initialRecord.dropOffTime.split(",")[1]?.trim() || "" : ""}
                </span>
              </div>
            </div>

            {/* Weight & Type */}
            <div className="bg-[#eff4ff]/60 dark:bg-muted/30 rounded-xl p-2.5 flex flex-col justify-between border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                Weight & Type
              </span>
              <div className="mt-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-extrabold text-foreground tabular-nums">
                    {initialRecord.weight}
                  </span>
                  <span className="text-[11px] font-bold text-muted-foreground">kg</span>
                </div>
                <span className="text-[11px] text-primary font-semibold truncate block">
                  {initialRecord.washType}
                </span>
              </div>
            </div>

            {/* Add-ons */}
            <div className="bg-[#eff4ff]/60 dark:bg-muted/30 rounded-xl p-2.5 flex flex-col justify-between border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                Add-ons
              </span>
              <div className="mt-1">
                <div className="text-xs font-bold text-foreground truncate">
                  {initialRecord.addOns && initialRecord.addOns.length > 0
                    ? initialRecord.addOns.join(", ")
                    : "None"}
                </div>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {initialRecord.addOns && initialRecord.addOns.length > 0 ? "Included" : "Standard cycle"}
                </span>
              </div>
            </div>

            {/* Total Bill */}
            <div className="bg-purple-50/50 dark:bg-purple-950/30 rounded-xl p-2.5 flex flex-col justify-between border border-purple-200/60 dark:border-purple-900/50">
              <span className="text-[10px] text-purple-900 dark:text-purple-300 uppercase tracking-wider font-bold">
                Total Bill
              </span>
              <div className="mt-1 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-base sm:text-xl font-extrabold text-foreground tabular-nums">
                  ₱{initialRecord.balanceDue.toLocaleString()}
                </span>
                <span className={cn(
                  "text-[10px] font-bold",
                  isPaid ? "text-emerald-600" : "text-rose-600"
                )}>
                  {isPaid ? "Paid in full" : "Collect at Pickup"}
                </span>
              </div>
            </div>

            {/* Target ETA */}
            <div className="bg-[#eff4ff]/60 dark:bg-muted/30 rounded-xl p-2.5 flex flex-col justify-between border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                Estimated Pickup
              </span>
              <div className="mt-1">
                <div className="text-xs font-bold text-foreground truncate">
                  {eta ? formatReadableDateTime(eta) : "In progress"}
                </div>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {eta ? "Estimated ETA" : "Est. 45–60 mins cycle"}
                </span>
              </div>
            </div>
          </div>

          {/* Special Instructions (when present) */}
          {initialRecord.washInstructions && (
            <div className="bg-[#eff4ff]/60 dark:bg-muted/30 rounded-xl p-2.5 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block mb-1">
                Special Instructions
              </span>
              <p className="text-xs text-foreground font-medium">
                {initialRecord.washInstructions}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── 2. PICKUP QR CODE PASS (Revealed when Ready or Claimed) ───────── */}
      {(status === "Ready" || status === "Claimed") && (
        <section
          className="bg-white rounded-3xl p-4 sm:p-5 shadow-[0_10px_30px_rgba(11,28,48,0.06)] border border-border/70 animate-in fade-in slide-in-from-bottom-2 duration-300"
          data-purpose="qr-pass-section"
        >
          {/* Section Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground tracking-tight">Pickup QR Code</h2>
            </div>
            <span className="text-[11px] font-mono font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {initialRecord.ticketId}
            </span>
          </div>

          {/* QR Box Frame Container */}
          <div className="bg-[#eff4ff]/60 dark:bg-muted/20 border border-border/60 rounded-2xl p-4 text-center">
            {/* Scannable High-Contrast QR Code */}
            <div className="bg-white p-3 rounded-2xl inline-block shadow-sm border border-border/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pickupQrUrl}
                alt={`Pickup QR code for ${initialRecord.ticketId}`}
                className="w-40 h-40 sm:w-44 sm:h-44 object-contain"
              />
            </div>
            <h3 className="text-xs font-bold text-foreground mt-3">Show this QR code at pickup</h3>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto mt-1 leading-relaxed">
              The shop can scan this code in Claim Verification to open your order quickly and complete the claim.
            </p>

            {/* Claim Code Text Box with Copy Action */}
            <div className="mt-3.5 bg-white dark:bg-card border border-border rounded-xl p-3 text-left">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  CLAIM CODE
                </span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="text-[10px] text-primary hover:underline font-semibold inline-flex items-center gap-1 active:opacity-75 transition-opacity cursor-pointer"
                  data-purpose="copy-claim-button"
                >
                  {copied ? (
                    <span className="text-emerald-600 font-bold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Copied!
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Copy className="w-3 h-3" /> Copy
                    </span>
                  )}
                </button>
              </div>
              <p className="font-mono text-[11px] font-semibold text-foreground break-all select-all">
                {token}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                If the staff does not scan the QR code, they can paste this claim code into Claim Verification and your transaction will appear automatically.
              </p>
            </div>

            {/* Counter Storefront Tag */}
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-card border border-border/60 text-muted-foreground text-[11px] font-medium shadow-xs">
              <Store className="w-3.5 h-3.5 text-primary" />
              <span>{initialRecord.shopProfile.shopName} • Counter Terminal</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
