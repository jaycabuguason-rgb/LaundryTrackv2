"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Inbox,
  RotateCw,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";

import { formatReadableDateTime } from "@/lib/date-format";
import { StatusBadge } from "@/components/status-badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PublicTrackingRecord } from "@/lib/transaction-contracts";
import type { TransactionStatus } from "@/lib/data";
import { cn } from "@/lib/utils";

interface TrackingStep {
  id: "Received" | "Washed" | "Ready";
  label: string;
  icon: LucideIcon;
  description: string;
}

const TRACKING_STEPS: readonly TrackingStep[] = [
  {
    id: "Received",
    label: "Received",
    icon: Inbox,
    description: "Clothes logged & queued",
  },
  {
    id: "Washed",
    label: "Washed",
    icon: RotateCw,
    description: "Washing & drying cycle",
  },
  {
    id: "Ready",
    label: "Ready",
    icon: ShoppingBag,
    description: "Packed & ready for pickup",
  },
] as const;

function getTrackingProgressIndex(status: string): number {
  if (status === "Claimed") return 3; // All 3 stages completed
  if (status === "Ready") return 2;   // Step 3 (Ready) active
  if (status === "Washing" || status === "Drying") return 1; // Step 2 (Washed) active
  return 0; // Step 1 (Received) active
}

export function StatusStepper({ status }: { status: string }) {
  const activeIndex = getTrackingProgressIndex(status);

  if (status === "Voided") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
        This order was voided. Please contact the shop for assistance.
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-1 sm:gap-2 overflow-x-auto pb-1 pt-1">
      {TRACKING_STEPS.map((step, index) => {
        const completed = index < activeIndex || status === "Claimed";
        const current = index === activeIndex && status !== "Claimed";
        const StepIcon = step.icon;

        return (
          <div key={step.id} className="flex min-w-[90px] flex-1 items-start">
            <div className="flex w-full flex-col items-center gap-2">
              <div className="relative">
                {/* Active glow/ping ring for current stage */}
                {current && (
                  <span
                    className="absolute -inset-1.5 rounded-full bg-primary/25 animate-ping opacity-60 pointer-events-none"
                    aria-hidden="true"
                  />
                )}
                <div
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300",
                    completed
                      ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                      : current
                        ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-md shadow-primary/30 scale-105"
                        : "border-border bg-background text-muted-foreground",
                  )}
                  aria-label={`${step.label} stage: ${completed ? "completed" : current ? "in progress" : "pending"}`}
                >
                  {completed ? (
                    <CheckCircle2 className="h-5 w-5 animate-in zoom-in-75 duration-200" />
                  ) : (
                    <StepIcon
                      className={cn(
                        "h-5 w-5 transition-transform duration-300",
                        current && step.id === "Received" && "animate-stage-bounce",
                        current && step.id === "Washed" && "animate-stage-spin",
                        current && step.id === "Ready" && "animate-stage-sparkle text-amber-300",
                      )}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <span
                  className={cn(
                    "text-xs leading-tight font-medium",
                    current
                      ? "font-bold text-primary"
                      : completed
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
                {current && (
                  <span className="mt-0.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary animate-pulse">
                    In Progress
                  </span>
                )}
              </div>
            </div>
            {index < TRACKING_STEPS.length - 1 && (
              <div className="relative mt-5 h-1 flex-1 mx-1 rounded-full bg-border overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    index < activeIndex || status === "Claimed"
                      ? "w-full bg-primary"
                      : index === activeIndex
                        ? "w-1/2 bg-primary/70 animate-pulse"
                        : "w-0",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
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

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const isActive = ACTIVE_TRACKING_STATUSES.includes(status);

  // Trigger brief visual cue on live status update
  const notifyUpdated = () => {
    setLastSynced(new Date());
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 1200);
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
    <div className="space-y-6">
      {/* Ticket Info Card */}
      <section className={cn(
        "rounded-3xl border border-border/80 bg-background/95 p-6 shadow-sm backdrop-blur transition-all duration-300",
        isPulsing && "ring-2 ring-primary/40"
      )}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Ticket ID
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight font-mono tabular-nums">
              {initialRecord.ticketId}
            </h1>
            {initialRecord.customerName && (
              <div className="mt-2 flex items-center gap-1.5 text-sm">
                <User className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">
                  Recipient: <span className="font-semibold text-foreground">{initialRecord.customerName}</span>
                </span>
              </div>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              Drop-off: {initialRecord.dropOffTime}
            </p>
            {eta && (
              <p className="mt-1 text-sm font-medium text-foreground">
                Estimated pickup: {formatReadableDateTime(eta)}
              </p>
            )}
          </div>
          <StatusBadge status={status} className="px-3 py-1 text-xs font-semibold transition-all duration-300" />
        </div>

        {/* Ready for Pickup Celebration Banner */}
        {status === "Ready" && (
          <div className="mt-5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-950 dark:text-emerald-100 flex items-start gap-3.5 shadow-xs animate-in fade-in duration-300">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Your Laundry is Ready for Pickup!</h3>
              <p className="text-xs text-emerald-900/90 dark:text-emerald-300/90 mt-0.5 leading-relaxed">
                All items are washed and neatly packaged. Present your ticket ID or QR pass at the shop counter to claim.
              </p>
            </div>
          </div>
        )}

        {/* Status Timeline */}
        <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status Timeline
          </p>
          <StatusStepper status={status} />
          
          {/* Live Sync Status Indicator (Zero Reload) */}
          {isActive ? (
            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Live tracking active</span>
              <span className="text-muted-foreground/40">•</span>
              <span className="tabular-nums text-[11px]">
                Synced {lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
              </span>
            </div>
          ) : (
            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Order completed</span>
            </div>
          )}
        </div>
      </section>

      {/* Pickup QR Code - Only show when Ready */}
      {status === "Ready" && (
        <section className="rounded-3xl border border-border bg-background p-5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Pickup QR Code
          </div>
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-border bg-muted/20 p-5 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pickupQrUrl}
              alt={`Pickup QR code for ${initialRecord.ticketId}`}
              width={220}
              height={220}
              className="rounded-xl border border-border bg-white p-2 shadow-sm"
            />
            <p className="mt-4 text-sm font-semibold text-foreground">
              Show this QR code at pickup
            </p>
            <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">
              The shop can scan this code in Claim Verification to open your order quickly and complete the claim.
            </p>
            <div className="mt-4 w-full max-w-md rounded-xl border border-border bg-background px-4 py-3 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Claim Code
              </p>
              <p className="mt-1 break-all font-mono text-sm font-semibold text-foreground">
                {token}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                If the staff does not scan the QR code, they can paste this claim code into Claim Verification and your transaction will appear automatically.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
