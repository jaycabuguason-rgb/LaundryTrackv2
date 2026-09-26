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
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        This order was voided. Please contact the shop for assistance.
      </div>
    );
  }

  return (
    <div className="relative px-2">
      {/* Connecting background line */}
      <div className="absolute top-4 left-10 right-10 h-0.5 bg-purple-100 -z-0">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{
            width: activeIndex >= 2 || status === "Claimed" ? "100%" : activeIndex === 1 ? "50%" : "0%",
          }}
        />
      </div>

      <div className="flex items-start justify-between relative z-10">
        {TRACKING_STEPS.map((step, index) => {
          const completed = index < activeIndex || status === "Claimed";
          const current = index === activeIndex && status !== "Claimed";
          const StepIcon = step.icon;

          return (
            <div key={step.id} className="flex flex-col items-center text-center w-24">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-xs",
                  completed
                    ? "bg-primary text-white"
                    : current
                      ? "bg-primary text-white ring-4 ring-primary/20 shadow-sm"
                      : "bg-stone-100 text-stone-400 border border-stone-200"
                )}
                aria-label={`${step.label} stage: ${completed ? "completed" : current ? "in progress" : "pending"}`}
              >
                {completed ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <StepIcon
                    className={cn(
                      "w-4 h-4",
                      current && step.id === "Received" && "animate-stage-bounce",
                      current && step.id === "Washed" && "animate-stage-spin",
                      current && step.id === "Ready" && "animate-stage-sparkle text-amber-300",
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-xs mt-2 leading-tight",
                  current
                    ? "font-bold text-primary"
                    : completed
                      ? "font-semibold text-slate-800"
                      : "text-slate-400 font-medium",
                )}
              >
                {step.label}
              </span>
              {current && (
                <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-0.5 animate-pulse">
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
      {/* BEGIN: TicketOverviewCard */}
      <section
        className={cn(
          "bg-white rounded-2xl p-5 shadow-sm border border-stone-200/90 relative transition-all duration-300",
          isPulsing && "ring-2 ring-primary/40",
        )}
        data-purpose="ticket-summary-card"
      >
        {/* Top Ticket ID Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-primary uppercase block mb-0.5">
              TICKET ID
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
              {initialRecord.ticketId}
            </h2>
          </div>
          {/* Status Badge */}
          <StatusBadge status={status} className="px-3 py-1 text-xs font-semibold shadow-xs" />
        </div>

        {/* Recipient & Drop-off Timestamps */}
        <div className="mt-2.5 space-y-1 text-[13px] text-slate-600">
          {initialRecord.customerName && (
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                Recipient: <strong className="font-semibold text-slate-800">{initialRecord.customerName}</strong>
              </span>
            </div>
          )}
          <p className="text-xs text-slate-500 pl-5.5">
            Drop-off: <time>{initialRecord.dropOffTime}</time>
          </p>
          {eta && (
            <p className="text-xs text-primary font-medium pl-5.5">
              Estimated pickup: {formatReadableDateTime(eta)}
            </p>
          )}
        </div>

        {/* Status Callout Alert Box */}
        {status === "Ready" && (
          <div className="mt-4 p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200/90 flex items-start gap-3 animate-in fade-in duration-300" data-purpose="ready-pickup-alert">
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
          <div className="mt-4 p-3.5 bg-sky-50/80 rounded-xl border border-sky-200/90 flex items-start gap-3 animate-in fade-in duration-300">
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
          <div className="mt-4 p-3.5 bg-purple-50/80 rounded-xl border border-purple-200/90 flex items-start gap-3 animate-in fade-in duration-300">
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

        {/* Nested Status Timeline */}
        <div className="mt-4 pt-4 border-t border-stone-100" data-purpose="status-timeline-widget">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-4">
            STATUS TIMELINE
          </p>
          <StatusStepper status={status} />

          {/* Sync Status Line */}
          {isActive ? (
            <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live tracking active</span>
              <span>•</span>
              <span className="tabular-nums">
                Synced {lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
              </span>
            </div>
          ) : (
            <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Order completed</span>
            </div>
          )}
        </div>
      </section>
      {/* END: TicketOverviewCard */}

      {/* BEGIN: PickupQRCodePass (Revealed when Ready or Claimed) */}
      {(status === "Ready" || status === "Claimed") && (
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/90 animate-in fade-in slide-in-from-bottom-2 duration-300" data-purpose="qr-pass-section">
          {/* Section Header */}
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">Pickup QR Code</h2>
          </div>
          {/* QR Box Frame Container */}
          <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-4 text-center">
            {/* Scannable High-Contrast QR Code */}
            <div className="bg-white p-3 rounded-xl inline-block shadow-sm border border-stone-200/80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pickupQrUrl}
                alt={`Pickup QR code for ${initialRecord.ticketId}`}
                className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
              />
            </div>
            <h3 className="text-xs font-bold text-slate-800 mt-3">Show this QR code at pickup</h3>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
              The shop can scan this code in Claim Verification to open your order quickly and complete the claim.
            </p>
            {/* Claim Code Text Box with Copy Action */}
            <div className="mt-3.5 bg-white border border-stone-200 rounded-lg p-3 text-left">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">CLAIM CODE</span>
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
              <p className="font-mono text-[11px] font-semibold text-slate-800 break-all select-all">
                {token}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                If the staff does not scan the QR code, they can paste this claim code into Claim Verification and your transaction will appear automatically.
              </p>
            </div>
          </div>
        </section>
      )}
      {/* END: PickupQRCodePass */}
    </div>
  );
}
