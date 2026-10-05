"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Inbox,
  RotateCw,
  ShoppingBag,
  PackageCheck,
  ShieldCheck,
  User,
  Package,
  CreditCard,
  Info,
  MapPin,
  Phone,
  Mail,
  AlertTriangle,
} from "lucide-react";

import { formatReadableDateTime } from "@/lib/date-format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PublicTrackingRecord } from "@/lib/transaction-contracts";
import type { TransactionStatus } from "@/lib/data";
import { cn } from "@/lib/utils";

function getTrackingProgressIndex(status: string): number {
  if (status === "Claimed") return 3;
  if (status === "Ready") return 2;
  if (status === "Washing" || status === "Drying") return 1;
  return 0; // Received
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
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialRecord.updatedAt);
  const [claimedAt, setClaimedAt] = useState<string | null>(initialRecord.claimedAt ?? null);
  const [paymentStatus, setPaymentStatus] = useState(initialRecord.paymentStatus);
  const [balanceDue, setBalanceDue] = useState<number>(initialRecord.balanceDue);
  const [totalAmount, setTotalAmount] = useState<number | undefined>(initialRecord.totalAmount);
  const [loads, setLoads] = useState<number | undefined>(initialRecord.loads);
  const [enablePaymentOption, setEnablePaymentOption] = useState<boolean>(initialRecord.enablePaymentOption ?? true);
  const [lastSynced, setLastSynced] = useState<Date>(() => new Date());
  const [isPulsing, setIsPulsing] = useState(false);
  const [copied, setCopied] = useState(false);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const isActive = ACTIVE_TRACKING_STATUSES.includes(status);
  const isPaid = paymentStatus === "paid";
  const isFlexibleUnpaid = enablePaymentOption && !isPaid;
  const displayFee = totalAmount ?? initialRecord.totalAmount ?? initialRecord.balanceDue ?? 0;
  const currentBalance = balanceDue ?? initialRecord.balanceDue ?? 0;
  const activeStepIndex = getTrackingProgressIndex(status);
  const isClaimedOrCompleted = (status as string) === "Claimed" || (status as string) === "Completed";

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
        (payload: { new?: { status?: string; eta?: string | null; updated_at?: string | null; claimed_at?: string | null; payment_status?: string | null } }) => {
          const newStatus = payload.new?.status;
          if (newStatus && typeof newStatus === "string" && newStatus !== statusRef.current) {
            setStatus(newStatus as TransactionStatus);
            notifyUpdated();
          }
          if (payload.new?.eta !== undefined) {
            setEta(payload.new.eta);
          }
          if (payload.new?.updated_at !== undefined) {
            setUpdatedAt(payload.new.updated_at);
          }
          if (payload.new?.claimed_at !== undefined) {
            setClaimedAt(payload.new.claimed_at);
          }
          if (payload.new?.payment_status) {
            setPaymentStatus(payload.new.payment_status as any);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [isActive, initialRecord.ticketId]);

  // 2. Resilient Lightweight JSON Poll (6s fallback, visibility-aware, zero reload)
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
        if (data?.updatedAt !== undefined) {
          setUpdatedAt(data.updatedAt);
        }
        if (data?.claimedAt !== undefined) {
          setClaimedAt(data.claimedAt);
        }
        if (data?.paymentStatus !== undefined) {
          setPaymentStatus(data.paymentStatus);
        }
        if (data?.balanceDue !== undefined) {
          setBalanceDue(data.balanceDue);
        }
        if (data?.totalAmount !== undefined) {
          setTotalAmount(data.totalAmount);
        }
        if (data?.loads !== undefined) {
          setLoads(data.loads);
        }
        if (data?.enablePaymentOption !== undefined) {
          setEnablePaymentOption(data.enablePaymentOption);
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

  const dropOffFormatted =
    formatReadableDateTime(initialRecord.dropOffTime) || initialRecord.dropOffTime;

  return (
    <div className="space-y-4">
      {/* ── CARD 1: TICKET OVERVIEW CARD ──────────────────────────────────── */}
      <section
        className={cn(
          "bg-white rounded-2xl p-5 shadow-sm border border-stone-200/90 relative transition-all duration-300",
          isPulsing && "ring-2 ring-purple-600/40",
        )}
        data-purpose="ticket-summary-card"
      >
        {/* Top Ticket ID Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-purple-700 uppercase block mb-0.5">
              TICKET ID
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {initialRecord.ticketId}
            </h2>
          </div>

          {/* Status Badge */}
          {status === "Ready" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              Ready
            </span>
          ) : status === "Claimed" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-stone-200 shadow-xs">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              Claimed
            </span>
          ) : status === "Washing" || status === "Drying" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              {status}
            </span>
          ) : status === "Voided" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 shadow-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              Voided
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-xs">
              <Inbox className="w-3.5 h-3.5" />
              Received
            </span>
          )}
        </div>

        {/* Recipient & Drop-off Timestamps */}
        <div className="mt-2.5 space-y-1 text-[13px] text-slate-600">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              Recipient:{" "}
              <strong className="font-semibold text-slate-800">
                {initialRecord.customerName}
              </strong>
            </span>
          </div>
          <p className="text-xs text-slate-500 pl-5.5">
            Drop-off: <time>{dropOffFormatted}</time>
          </p>
        </div>

        {/* Contextual Status Alert Box */}
        {status === "Ready" && (
          <div
            className="mt-4 p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200/90 flex items-start gap-3"
            data-purpose="ready-pickup-alert"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-950">
                Your Laundry is Ready for Pickup!
              </h3>
              <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                All items are washed and neatly packaged. Present your ticket ID or QR pass at the shop counter to claim.
              </p>
            </div>
          </div>
        )}

        {(status === "Washing" || status === "Drying") && (
          <div
            className="mt-4 p-3.5 bg-sky-50/80 rounded-xl border border-sky-200/90 flex items-start gap-3"
            data-purpose="washing-alert"
          >
            <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <RotateCw className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-sky-950">
                Your Laundry is Being Processed!
              </h3>
              <p className="text-[11px] text-sky-800 leading-relaxed mt-0.5">
                Our team is currently running the wash and dry cycle for your clothes.
              </p>
            </div>
          </div>
        )}

        {status === "Received" && (
          <div
            className="mt-4 p-3.5 bg-purple-50/80 rounded-xl border border-purple-200/90 flex items-start gap-3"
            data-purpose="received-alert"
          >
            <div className="w-8 h-8 rounded-full bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-purple-950">
                Order Received &amp; Queued
              </h3>
              <p className="text-[11px] text-purple-800 leading-relaxed mt-0.5">
                Your laundry has been received and will be scheduled for washing shortly.
              </p>
            </div>
          </div>
        )}

        {status === "Claimed" && (
          <div
            className="mt-4 p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200/90 flex items-start gap-3"
            data-purpose="claimed-alert"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Check className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-950">
                Order Claimed &amp; Released
              </h3>
              <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                This order has been picked up and handed over. Thank you for choosing {initialRecord.shopProfile.shopName}!
              </p>
            </div>
          </div>
        )}

        {status === "Voided" && (
          <div
            className="mt-4 p-3.5 bg-red-50/80 rounded-xl border border-red-200/90 flex items-start gap-3"
            data-purpose="voided-alert"
          >
            <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-red-950">Order Voided</h3>
              <p className="text-[11px] text-red-800 leading-relaxed mt-0.5">
                This transaction has been voided or cancelled. Please contact the shop counter for assistance.
              </p>
            </div>
          </div>
        )}

        {/* ── Nested Status Timeline Sub-Card ─────────────────────────────── */}
        <div className="mt-4 pt-4 border-t border-stone-100" data-purpose="status-timeline-widget">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              STATUS TIMELINE
            </p>
            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2.5 py-0.5 rounded-full">
              {status === "Claimed"
                ? "Claimed & Completed"
                : status === "Ready"
                  ? "Ready for Pickup"
                  : status === "Washing" || status === "Drying"
                    ? "In Washing Cycle"
                    : "Order Received"}
            </span>
          </div>

          {/* Vertical Step Timeline */}
          <div className="relative pl-0.5 space-y-0">
            {/* Connecting Line */}
            <div className="absolute left-[15px] top-4 bottom-6 w-[2px] bg-gradient-to-b from-purple-700 via-purple-500 to-slate-200" />

            {/* STEP 1: Received */}
            {(() => {
              const isDone = activeStepIndex > 0 || status === "Claimed";
              const isCurrent = activeStepIndex === 0 && status !== "Claimed";
              return (
                <div className="flex items-start gap-3.5 relative pb-6">
                  {isDone ? (
                    <div className="w-8 h-8 rounded-full bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-sm relative z-10 ring-4 ring-white">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-purple-600 text-purple-700 flex items-center justify-center shrink-0 relative z-10 ring-4 ring-purple-100 shadow-sm">
                      <div className="w-3 h-3 rounded-full bg-purple-600 status-pulse" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-stone-300 text-slate-300 flex items-center justify-center shrink-0 relative z-10 ring-4 ring-white">
                      <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                    </div>
                  )}
                  <div className="pt-0.5 flex-1 min-w-0 flex items-start justify-between gap-2">
                    <div>
                      <h4 className={cn("text-xs leading-snug", isCurrent ? "font-bold text-purple-700" : isDone ? "font-bold text-slate-900" : "font-semibold text-slate-500")}>
                        Received
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{dropOffFormatted}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Order logged &amp; inspected at counter</p>
                    </div>
                    <span className={cn(
                      "shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs",
                      isDone
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                        : isCurrent
                          ? "bg-purple-100 text-purple-700 border border-purple-200"
                          : "bg-stone-100 text-slate-500 border border-stone-200/80 font-medium"
                    )}>
                      {isDone ? "Done" : isCurrent ? "Live" : "Pending"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* STEP 2: Washed */}
            {(() => {
              const isDone = activeStepIndex > 1 || status === "Claimed";
              const isCurrent = activeStepIndex === 1 && status !== "Claimed";
              return (
                <div className="flex items-start gap-3.5 relative pb-6">
                  {isDone ? (
                    <div className="w-8 h-8 rounded-full bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-sm relative z-10 ring-4 ring-white">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-purple-600 text-purple-700 flex items-center justify-center shrink-0 relative z-10 ring-4 ring-purple-100 shadow-sm">
                      <div className="w-3 h-3 rounded-full bg-purple-600 status-pulse" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-stone-300 text-slate-300 flex items-center justify-center shrink-0 relative z-10 ring-4 ring-white">
                      <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                    </div>
                  )}
                  <div className="pt-0.5 flex-1 min-w-0 flex items-start justify-between gap-2">
                    <div>
                      <h4 className={cn("text-xs leading-snug", isCurrent ? "font-bold text-purple-700" : isDone ? "font-bold text-slate-900" : "font-semibold text-slate-500")}>
                        {status === "Washing" || status === "Drying" ? "Washing" : "Washed"}
                      </h4>
                      {(isCurrent || isDone) && updatedAt ? (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formatReadableDateTime(updatedAt)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Queued for cycle
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {isCurrent ? "Active drum cycle • " : isDone ? "Cycle completed • " : ""}
                        {initialRecord.washType || "Regular"} wash cycle
                        {initialRecord.addOns && initialRecord.addOns.length > 0
                          ? ` & ${initialRecord.addOns.join(", ")}`
                          : " treatment"}
                      </p>
                    </div>
                    <span className={cn(
                      "shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs",
                      isDone
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                        : isCurrent
                          ? "bg-purple-100 text-purple-700 border border-purple-200"
                          : "bg-stone-100 text-slate-500 border border-stone-200/80 font-medium"
                    )}>
                      {isDone ? "Done" : isCurrent ? "Live" : "Pending"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* STEP 3: Ready for Pickup */}
            {(() => {
              const isDone = activeStepIndex > 2 || status === "Claimed";
              const isCurrent = activeStepIndex === 2 && status !== "Claimed";
              return (
                <div className="flex items-start gap-3.5 relative pb-6">
                  {isDone ? (
                    <div className="w-8 h-8 rounded-full bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-sm relative z-10 ring-4 ring-white">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-purple-600 text-purple-700 flex items-center justify-center shrink-0 relative z-10 ring-4 ring-purple-100 shadow-sm">
                      <div className="w-3 h-3 rounded-full bg-purple-600 status-pulse" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-stone-300 text-slate-300 flex items-center justify-center shrink-0 relative z-10 ring-4 ring-white">
                      <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                    </div>
                  )}
                  <div className="pt-0.5 flex-1 min-w-0 flex items-start justify-between gap-2">
                    <div>
                      <h4 className={cn("text-xs leading-snug", isCurrent ? "font-bold text-purple-700" : isDone ? "font-bold text-slate-900" : "font-semibold text-slate-500")}>
                        Ready for Pickup
                      </h4>
                      {isCurrent && updatedAt ? (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formatReadableDateTime(updatedAt)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {isDone
                            ? "Completed & ready"
                            : eta
                              ? `Est. ${formatReadableDateTime(eta)}`
                              : "Awaiting cycle completion"}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {isCurrent ? "Package is ready at pickup counter • " : ""}
                        Folded, bagged &amp; tagged #{initialRecord.ticketId}
                      </p>
                    </div>
                    <span className={cn(
                      "shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs",
                      isDone
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                        : isCurrent
                          ? "bg-purple-100 text-purple-700 border border-purple-200"
                          : "bg-stone-100 text-slate-500 border border-stone-200/80 font-medium"
                    )}>
                      {isDone ? "Done" : isCurrent ? "Live" : "Pending"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* STEP 4: Claimed */}
            {(() => {
              const isDone = status === "Claimed";
              return (
                <div className="flex items-start gap-3.5 relative">
                  {isDone ? (
                    <div className="w-8 h-8 rounded-full bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-sm relative z-10 ring-4 ring-white">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-stone-300 text-slate-300 flex items-center justify-center shrink-0 relative z-10 ring-4 ring-white">
                      <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                    </div>
                  )}
                  <div className="pt-0.5 flex-1 min-w-0 flex items-start justify-between gap-2">
                    <div>
                      <h4 className={cn("text-xs leading-snug", isDone ? "font-bold text-purple-700" : "font-semibold text-slate-500")}>
                        Claimed
                      </h4>
                      {isDone && (claimedAt || updatedAt) ? (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formatReadableDateTime(claimedAt || updatedAt)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Expected upon arrival
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {isDone ? "Handed over to customer at counter" : "Present QR pass at shop counter to release"}
                      </p>
                    </div>
                    <span className={cn(
                      "shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] shadow-xs",
                      isDone
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-bold"
                        : "bg-stone-100 text-slate-500 border border-stone-200/80 font-medium"
                    )}>
                      {isDone ? "Done" : "Pending"}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Bottom Current Status Box & Sync Time */}
          <div className="mt-5 pt-3.5 border-t border-stone-100">
            <div className="p-3 bg-purple-50/70 border border-purple-200/70 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-wider text-purple-700 uppercase">
                    Current Status
                  </p>
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {status === "Claimed"
                      ? "Claimed & Completed"
                      : status === "Ready"
                        ? "Ready for Counter Pickup"
                        : status === "Washing" || status === "Drying"
                          ? "In Drum & Dry Cycle"
                          : "Order Logged & Queued"}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-medium text-slate-500">
                  {eta ? "Pickup Target" : "Pickup Hours"}
                </p>
                <p className="text-xs font-extrabold text-purple-700">
                  {eta ? formatReadableDateTime(eta) : "Until 7:00 PM"}
                </p>
              </div>
            </div>

            {isActive ? (
              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 status-pulse" />
                <span>Live tracking active</span>
                <span>•</span>
                <span className="tabular-nums">
                  Synced{" "}
                  {lastSynced.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
            ) : (
              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                <span>Order completed</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── CARD 2: PICKUP QR CODE PASS ──────────────────────────────────── */}
      {!isClaimedOrCompleted && (
        <section
          className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/90"
          data-purpose="qr-pass-section"
        >
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-purple-700" />
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">Pickup QR Code</h2>
          </div>

          <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-4 text-center">
            <div className="bg-white p-3.5 rounded-xl inline-block shadow-sm border border-stone-200/80">
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
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  CLAIM CODE
                </span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="text-[10px] text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1 active:opacity-75 transition-opacity cursor-pointer"
                  data-purpose="copy-claim-button"
                >
                  {copied ? (
                    <span className="text-emerald-600 font-bold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Copied!
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
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

      {/* ── CARD 3: LAUNDRY DETAILS CARD ──────────────────────────────────── */}
      <section
        className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/90"
        data-purpose="laundry-details-section"
      >
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-purple-700" />
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Laundry Details</h2>
        </div>
        <dl className="divide-y divide-stone-100 text-xs">
          <div className="flex justify-between py-2">
            <dt className="text-slate-500 font-medium">Recipient</dt>
            <dd className="text-slate-800 font-semibold">{initialRecord.customerName}</dd>
          </div>
          {initialRecord.customerPhone && (
            <div className="flex justify-between py-2">
              <dt className="text-slate-500 font-medium">Phone</dt>
              <dd className="text-slate-800 font-semibold">{initialRecord.customerPhone}</dd>
            </div>
          )}
          {initialRecord.weight > 0 ? (
            <div className="flex justify-between py-2">
              <dt className="text-slate-500 font-medium">Weight</dt>
              <dd className="text-slate-800 font-semibold">{initialRecord.weight} kg</dd>
            </div>
          ) : (
            <div className="flex justify-between py-2">
              <dt className="text-slate-500 font-medium">Load Size</dt>
              <dd className="text-slate-800 font-semibold">
                {(loads ?? initialRecord.loads) && (loads ?? initialRecord.loads)! > 0
                  ? `${loads ?? initialRecord.loads} ${(loads ?? initialRecord.loads) === 1 ? "load" : "loads"}`
                  : "1 load"}
              </dd>
            </div>
          )}
          <div className="flex justify-between py-2">
            <dt className="text-slate-500 font-medium">Wash Type</dt>
            <dd className="text-slate-800 font-semibold">{initialRecord.washType || "Regular"}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-slate-500 font-medium">Add-ons</dt>
            <dd className="text-slate-800 font-semibold">
              {initialRecord.addOns && initialRecord.addOns.length > 0
                ? initialRecord.addOns.join(", ")
                : "None"}
            </dd>
          </div>
          {initialRecord.washInstructions && (
            <div className="flex justify-between py-2">
              <dt className="text-slate-500 font-medium">Special Instructions</dt>
              <dd className="text-slate-800 font-semibold text-right max-w-[60%]">
                {initialRecord.washInstructions}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* ── CARD 4: PAYMENT SUMMARY CARD ──────────────────────────────────── */}
      <section
        className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/90"
        data-purpose="payment-section"
      >
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-purple-700" />
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Payment</h2>
        </div>

        <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              STATUS
            </span>
            {isPaid ? (
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                Paid
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                Unpaid
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isFlexibleUnpaid ? "BALANCE DUE" : "PAID AMOUNT"}
            </span>
            <span
              className={cn(
                "text-xl font-extrabold",
                isFlexibleUnpaid ? "text-amber-700" : "text-emerald-700"
              )}
            >
              ₱{isFlexibleUnpaid ? currentBalance.toLocaleString() : displayFee.toLocaleString()}
            </span>
          </div>
        </div>

        {isFlexibleUnpaid ? (
          <div className="mt-3 p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-lg text-center">
            <p className="text-[10px] text-amber-800 leading-normal">
              Online payment is not available here. Please settle any unpaid balance at the shop during pickup.
            </p>
          </div>
        ) : (
          <div className="mt-3 p-2.5 bg-emerald-50/60 border border-emerald-200/60 rounded-lg text-center">
            <p className="text-[10px] text-emerald-800 leading-normal font-medium">
              Payment received in full. Your laundry is being taken care of.
            </p>
          </div>
        )}
      </section>

      {/* ── CARD 5: PICKUP INSTRUCTIONS & CONTACT ─────────────────────────── */}
      <section
        className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/90"
        data-purpose="pickup-instructions-section"
      >
        <div className="flex items-center gap-2 mb-3.5">
          <Info className="w-4 h-4 text-purple-700" />
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">
            Pickup Instructions
          </h2>
        </div>

        <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-3.5 space-y-2 text-xs">
          <h3 className="font-bold text-slate-800 mb-1.5">
            {initialRecord.shopProfile.shopName}
          </h3>
          {initialRecord.shopProfile.address && (
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-purple-700 shrink-0" />
              <span>{initialRecord.shopProfile.address}</span>
            </div>
          )}
          {initialRecord.shopProfile.contactNumber && (
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-3.5 h-3.5 text-purple-700 shrink-0" />
              <a
                className="hover:underline text-slate-700 font-medium"
                href={`tel:${initialRecord.shopProfile.contactNumber}`}
              >
                {initialRecord.shopProfile.contactNumber}
              </a>
            </div>
          )}
          {initialRecord.shopProfile.email && (
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="w-3.5 h-3.5 text-purple-700 shrink-0" />
              <a
                className="hover:underline text-purple-700 font-medium"
                href={`mailto:${initialRecord.shopProfile.email}`}
              >
                {initialRecord.shopProfile.email}
              </a>
            </div>
          )}
        </div>

        <div className="mt-3 bg-stone-50/70 border border-stone-200/80 rounded-xl p-3 text-xs">
          <h4 className="font-bold text-slate-800 text-[11px] mb-0.5">Before Pickup</h4>
          <p className="text-slate-600 text-[11px]">
            {initialRecord.shopProfile.pickupInstructions ||
              "Present this receipt or QR code upon claiming."}
          </p>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500 font-medium italic">
            {initialRecord.shopProfile.receiptFooter || "Maraming salamat po!"}
          </p>
        </div>
      </section>
    </div>
  );
}
