"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  Star,
  Gift,
  Flame,
  QrCode,
  ExternalLink,
  History,
  Bell,
  BellRing,
  Sparkles,
} from "lucide-react";

import { formatReadableDateTime } from "@/lib/date-format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/status-badge";
import type { PublicTrackingRecord, PublicLoyaltyMemberRecord } from "@/lib/transaction-contracts";
import type { TransactionStatus } from "@/lib/data";
import { cn } from "@/lib/utils";

function getTrackingProgressIndex(status: string): number {
  if (status === "Claimed") return 3;
  if (status === "Ready") return 2;
  if (status === "Washing" || status === "Drying") return 1;
  return 0; // Received
}

const ACTIVE_TRACKING_STATUSES = ["Received", "Washing", "Drying", "Ready"];

function StampDots({ count, max = 7 }: { count: number; max?: number }) {
  const effectiveCount = Math.min(count, max);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < effectiveCount;
        return (
          <div
            key={i}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border-2 text-xs font-bold transition-all shadow-xs",
              filled
                ? "border-primary bg-primary text-primary-foreground scale-105 shadow-md shadow-primary/20"
                : "border-dashed border-border bg-muted/30 text-muted-foreground"
            )}
          >
            {filled ? <Star className="h-4 w-4 fill-current" /> : i + 1}
          </div>
        );
      })}
    </div>
  );
}

function playNotificationChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.frequency.setValueAtTime(880, now + 0.14); // A5
    gain2.gain.setValueAtTime(0.15, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.55);
  } catch {
    // Ignore audio errors
  }
}

function triggerBrowserNotification(title: string, options?: NotificationOptions) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, options);
  } catch {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.showNotification(title, options);
        })
        .catch(() => {});
    }
  }
  playNotificationChime();
}

export interface CustomerTrackingViewProps {
  initialRecord: PublicTrackingRecord;
  token: string;
  pickupQrUrl: string;
  initialLoyaltyRecord?: PublicLoyaltyMemberRecord | null;
  isLoyaltyEnabled?: boolean;
  memberBaseUrl?: string;
}

export function CustomerTrackingView({
  initialRecord,
  token,
  pickupQrUrl,
  initialLoyaltyRecord,
  isLoyaltyEnabled = true,
  memberBaseUrl,
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

  // Live Loyalty Record State (Updates in real-time on poll or push)
  const [loyaltyRecord, setLoyaltyRecord] = useState<PublicLoyaltyMemberRecord | null>(
    initialLoyaltyRecord ?? initialRecord.loyaltyRecord ?? null
  );

  // Browser Notification States & Permissions (Mobile & Desktop)
  const [notificationPermission, setNotificationPermission] = useState<string>("default");
  const hasNotifiedReadyRef = useRef<boolean>(initialRecord.status === "Ready");
  const hasNotifiedRewardRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }
  }, []);

  const pendingCount =
    loyaltyRecord?.pendingRewards ??
    (loyaltyRecord && loyaltyRecord.stampsUntilReward === 0 ? 1 : 0);

  const checkAndTriggerNotifications = (
    currentStatus: TransactionStatus,
    currentLoyalty: PublicLoyaltyMemberRecord | null
  ) => {
    // 1. Ready Notification (For both Loyalty members and non-loyalty customers)
    if (currentStatus === "Ready") {
      if (!hasNotifiedReadyRef.current) {
        hasNotifiedReadyRef.current = true;
        triggerBrowserNotification("🧺 Laundry Ready for Pickup!", {
          body: `Order #${initialRecord.ticketId} is ready for pickup at ${initialRecord.shopProfile.shopName}!`,
          icon: initialRecord.shopProfile.logoDataUrl || undefined,
        });
      }
    } else {
      hasNotifiedReadyRef.current = false;
    }

    // 2. Pending Reward Notification (For loyalty members)
    const currentPending =
      currentLoyalty?.pendingRewards ??
      (currentLoyalty && currentLoyalty.stampsUntilReward === 0 ? 1 : 0);
    if (currentPending > 0) {
      if (!hasNotifiedRewardRef.current) {
        hasNotifiedRewardRef.current = true;
        triggerBrowserNotification("🎁 Free Reward Ready to Claim!", {
          body: `Congratulations ${currentLoyalty?.name || ""}! You have earned a free ${currentLoyalty?.rewardDescription || "reward"}!`,
          icon: initialRecord.shopProfile.logoDataUrl || undefined,
        });
      }
    } else {
      hasNotifiedRewardRef.current = false;
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === "granted") {
        playNotificationChime();
        if (status === "Ready") {
          hasNotifiedReadyRef.current = true;
          triggerBrowserNotification("🧺 Laundry Ready for Pickup!", {
            body: `Order #${initialRecord.ticketId} is ready for pickup at ${initialRecord.shopProfile.shopName}!`,
            icon: initialRecord.shopProfile.logoDataUrl || undefined,
          });
        } else if (pendingCount > 0) {
          hasNotifiedRewardRef.current = true;
          triggerBrowserNotification("🎁 Free Reward Ready to Claim!", {
            body: `Congratulations ${loyaltyRecord?.name || ""}! You have earned a free ${loyaltyRecord?.rewardDescription || "reward"}!`,
            icon: initialRecord.shopProfile.logoDataUrl || undefined,
          });
        }
      }
    } catch {
      // User closed permission dialog
    }
  };

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
            checkAndTriggerNotifications(newStatus as TransactionStatus, loyaltyRecord);
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
  }, [isActive, initialRecord.ticketId, loyaltyRecord]);

  // 2. Resilient Lightweight JSON Poll (6s fallback, visibility-aware, zero reload)
  useEffect(() => {
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
        if (data?.loyaltyRecord !== undefined) {
          setLoyaltyRecord(data.loyaltyRecord);
        }
        checkAndTriggerNotifications(
          (data?.status as TransactionStatus) || statusRef.current,
          data?.loyaltyRecord !== undefined ? data.loyaltyRecord : loyaltyRecord
        );
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
  }, [token, loyaltyRecord]);

  const dropOffFormatted =
    formatReadableDateTime(initialRecord.dropOffTime) || initialRecord.dropOffTime;

  return (
    <div className="space-y-4">
      {/* Browser Notification Opt-In Banner */}
      {notificationPermission === "default" && (
        <div
          className="bg-purple-50/90 border border-purple-200/90 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-2xs"
          data-purpose="notification-permission-prompt"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 leading-tight">
                Enable Status & Reward Alerts
              </p>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5 truncate">
                Get notified on phone or PC when laundry is ready or rewards unlock
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestNotificationPermission}
            className="px-3 py-1.5 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            Notify Me
          </button>
        </div>
      )}

      {notificationPermission === "granted" && (
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 font-medium">
          <span className="flex items-center gap-1.5 text-emerald-600">
            <BellRing className="w-3.5 h-3.5" /> Alerts enabled on this device
          </span>
        </div>
      )}

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

      {/* ── CARD 6: LIVE LOYALTY & REWARDS (Auto-updates with 0 reload) ── */}
      {isLoyaltyEnabled && loyaltyRecord && (
        <section
          className="bg-white rounded-3xl border border-purple-200/90 p-4 sm:p-5 shadow-sm space-y-4"
          data-purpose="loyalty-member-section"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-700 text-white font-bold shadow-xs">
                {loyaltyRecord.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">{loyaltyRecord.name}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 px-2 py-0.5 text-[10px] font-bold border border-purple-200">
                    <Star className="w-3 h-3 fill-purple-700 text-purple-700" /> Member
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {loyaltyRecord.id.startsWith("MEM-")
                    ? loyaltyRecord.id
                    : `MEM-${loyaltyRecord.id.slice(-6).toUpperCase()}`}
                </p>
              </div>
            </div>

            {memberBaseUrl && (
              <Link
                href={`${memberBaseUrl}/${loyaltyRecord.id}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:underline"
              >
                Card <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          {/* Pending Reward Alert (Prominent if > 0) */}
          {pendingCount > 0 ? (
            <div
              className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 p-4 shadow-xs space-y-2.5 animate-pulse"
              data-purpose="pending-reward-alert"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-emerald-950">
                      🎉 Free Reward Ready to Claim!
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                      {pendingCount} READY
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    You have unlocked a{" "}
                    <strong className="font-bold underline">
                      {loyaltyRecord.rewardDescription || "Free Wash"}
                    </strong>
                    !
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-emerald-700 bg-emerald-100/60 rounded-xl px-3 py-1.5 leading-relaxed font-medium">
                Show your Member QR pass below to the counter staff to redeem! Your wash progress continues uninterrupted.
              </p>
            </div>
          ) : (
            /* Remaining Laundries Banner */
            <div className="rounded-2xl border border-purple-200/80 bg-purple-50/50 p-3.5 text-center">
              {loyaltyRecord.stampsUntilReward > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">
                    Only{" "}
                    <span className="text-purple-700 font-extrabold text-sm">
                      {loyaltyRecord.stampsUntilReward}
                    </span>{" "}
                    more {loyaltyRecord.stampsUntilReward === 1 ? "laundry" : "laundries"} remaining!
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Complete {loyaltyRecord.stampsUntilReward} more wash to earn your next{" "}
                    <span className="font-semibold text-purple-700">
                      {loyaltyRecord.rewardDescription}
                    </span>
                    .
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-emerald-700">
                    🎉 Congratulations! Free Reward Ready!
                  </p>
                  <p className="text-[11px] text-slate-500">
                    You have earned a{" "}
                    <span className="font-semibold text-slate-800">
                      {loyaltyRecord.rewardDescription}
                    </span>
                    . Claim it at the counter!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Stamp Progress Dots */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" /> Reward Progress
              </span>
              <span className="font-bold text-purple-700 text-[11px]">
                {loyaltyRecord.currentCycleStamps} / {loyaltyRecord.washesPerReward} Stamps
              </span>
            </div>
            <StampDots count={loyaltyRecord.currentCycleStamps} max={loyaltyRecord.washesPerReward} />
          </div>

          {/* Lifetime Stats */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-xl border border-stone-200/80 bg-stone-50/80 p-2.5 text-center">
              <p className="text-sm font-bold text-slate-900">{loyaltyRecord.totalVisits}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Visits</p>
            </div>
            <div className="rounded-xl border border-stone-200/80 bg-stone-50/80 p-2.5 text-center">
              <p className="text-sm font-bold text-slate-900">{loyaltyRecord.totalKgWashed} kg</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Washed</p>
            </div>
            <div className="rounded-xl border border-stone-200/80 bg-stone-50/80 p-2.5 text-center">
              <p className="text-sm font-bold text-slate-900">{loyaltyRecord.rewardsRedeemed}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Claimed</p>
            </div>
          </div>

          {/* Member QR Pass */}
          <div className="flex items-center gap-3.5 rounded-2xl border border-stone-200/80 bg-stone-50/80 p-3">
            <div className="bg-white p-1.5 rounded-xl shadow-xs border border-stone-200/80 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                  memberBaseUrl ? `${memberBaseUrl}/${loyaltyRecord.id}` : `/member/${loyaltyRecord.id}`
                )}`}
                alt={`Loyalty QR code for ${loyaltyRecord.name}`}
                className="w-16 h-16 object-contain rounded"
              />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-purple-700" /> Member Pass
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Show this QR code at checkout to quickly collect stamps and claim rewards!
              </p>
            </div>
          </div>

          {/* Laundry Records / History */}
          {loyaltyRecord.laundryRecords.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-purple-700" /> Laundry Records
                </h3>
                <span className="text-[10px] text-slate-400">
                  {loyaltyRecord.laundryRecords.length} records
                </span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {loyaltyRecord.laundryRecords.slice(0, 8).map((item, idx) => (
                  <div
                    key={`${item.ticketId}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-stone-200/80 bg-stone-50/60 p-2.5 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-800 text-[11px]">
                          {item.ticketId}
                        </span>
                        <StatusBadge status={item.status} className="px-1.5 py-0 text-[10px]" />
                        {item.rewardUsed && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-800 px-1 py-0 text-[9px] font-bold">
                            <Gift className="w-2.5 h-2.5" /> Reward
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {item.washType} {item.weight > 0 ? `• ${item.weight} kg` : ""}{" "}
                        {item.fee > 0 ? `• ₱${item.fee}` : ""}
                      </p>
                    </div>

                    <div className="text-right text-[10px]">
                      <span className="text-slate-400">{item.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Non-member promotional banner */}
      {isLoyaltyEnabled && !loyaltyRecord && (
        <section
          className="bg-white rounded-3xl border border-purple-200/90 p-5 shadow-sm text-center space-y-2"
          data-purpose="non-member-loyalty-promo"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-purple-50 text-purple-700">
            <Gift className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Earn Free Laundries With Every Wash!
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Ask our staff to enroll your number into our Loyalty Program on your next visit to collect stamps and earn free washes.
          </p>
        </section>
      )}
    </div>
  );
}
