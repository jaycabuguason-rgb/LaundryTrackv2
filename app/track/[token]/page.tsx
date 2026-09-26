import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Star,
  Gift,
  Sparkles,
  Flame,
  QrCode,
  ExternalLink,
  History,
  Store,
} from "lucide-react";

import { CustomerTrackingView } from "@/components/customer-tracking-view";
import { StatusBadge } from "@/components/status-badge";
import { getPublicTrackingRecord } from "@/lib/server/laundry-repository";
import { getPublicLoyaltyMemberRecord, getLoyaltySettings } from "@/lib/server/loyalty-repository";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

export default async function PublicTrackingPage(
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const [record, loyaltySettings] = await Promise.all([
    getPublicTrackingRecord(token),
    getLoyaltySettings(),
  ]);
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const trackingUrl = `${protocol}://${host}/track/${token}`;
  const pickupQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(trackingUrl)}`;

  if (!record) {
    notFound();
  }

  const isLoyaltyEnabled = Boolean(loyaltySettings?.loyalty_enabled);

  const loyaltyRecord = (isLoyaltyEnabled && (record.customerPhone || record.customerName))
    ? await getPublicLoyaltyMemberRecord(record.customerPhone || record.customerName)
    : null;

  return (
    <div className="min-h-screen force-light bg-[#f8f9ff] py-6 px-3 sm:px-6 text-slate-800 antialiased">
      {/* Constrained max width perfectly suited for Mobile viewing */}
      <main className="max-w-[480px] mx-auto space-y-4" data-purpose="mobile-tracking-container">
        {/* BEGIN: BrandHeader */}
        <header className="text-center pt-2 pb-1" data-purpose="shop-brand-header">
          {/* Centered Shop Avatar/Badge */}
          <div className="inline-flex items-center justify-center p-1.5 bg-white rounded-2xl shadow-xs border border-border/80 mb-2">
            {record.shopProfile.logoDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={record.shopProfile.logoDataUrl}
                alt={`${record.shopProfile.shopName} Shop Logo`}
                className="w-14 h-14 object-cover rounded-xl"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                {record.shopProfile.shopName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-snug">
            {record.shopProfile.shopName}
          </h1>
          <p className="text-xs text-slate-500 font-medium tracking-wide mt-0.5">
            Powered by <span className="text-primary font-semibold">LaundryTrack</span>
          </p>
        </header>
        {/* END: BrandHeader */}

        {/* Dynamic Live Customer Tracking & Pickup QR Code (Zero-Reload) */}
        <CustomerTrackingView
          initialRecord={record}
          token={token}
          pickupQrUrl={pickupQrUrl}
        />

        {/* BEGIN: PickupInstructionsAndContact */}
        <section
          className="bg-white rounded-3xl p-4 sm:p-5 shadow-[0_10px_30px_rgba(11,28,48,0.06)] border border-border/70"
          data-purpose="pickup-instructions-section"
        >
          <div className="flex items-center gap-2 mb-3">
            <Store className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">Pickup & Store Information</h2>
          </div>

          {/* Shop Info Container */}
          <div className="bg-[#eff4ff]/60 dark:bg-muted/20 border border-border/60 rounded-2xl p-3.5 space-y-2 text-xs">
            <h3 className="font-bold text-slate-800">{record.shopProfile.shopName}</h3>
            {record.shopProfile.address && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{record.shopProfile.address}</span>
              </div>
            )}
            {record.shopProfile.contactNumber && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                <a className="hover:underline text-slate-700 font-medium" href={`tel:${record.shopProfile.contactNumber}`}>
                  {record.shopProfile.contactNumber}
                </a>
              </div>
            )}
            {record.shopProfile.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                <a className="hover:underline text-primary font-medium" href={`mailto:${record.shopProfile.email}`}>
                  {record.shopProfile.email}
                </a>
              </div>
            )}
          </div>

          {/* Before Pickup Note */}
          <div className="mt-3 bg-[#eff4ff]/60 dark:bg-muted/20 border border-border/60 rounded-2xl p-3 text-xs">
            <h4 className="font-bold text-slate-800 text-[11px] mb-0.5">Before Pickup</h4>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              {record.shopProfile.pickupInstructions || "Present your ticket number or QR pass upon claiming at the counter."}
            </p>
          </div>

          {/* Warm Closing Salutation */}
          <div className="mt-3.5 text-center">
            <p className="text-xs text-slate-500 font-medium italic">
              {record.shopProfile.receiptFooter || "Maraming salamat po!"}
            </p>
          </div>
        </section>
        {/* END: PickupInstructionsAndContact */}

        {/* Loyalty & Rewards Section (Shown at bottom for members) */}
        {isLoyaltyEnabled && loyaltyRecord && (
          <section className="bg-white rounded-3xl border border-primary/25 p-4 sm:p-5 shadow-[0_10px_30px_rgba(11,28,48,0.06)] space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
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
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold border border-primary/20">
                      <Sparkles className="w-3 h-3" /> Loyalty Member
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {loyaltyRecord.id.startsWith("MEM-") ? loyaltyRecord.id : `MEM-${loyaltyRecord.id.slice(-6).toUpperCase()}`}
                  </p>
                </div>
              </div>

              <Link
                href={`/member/${loyaltyRecord.id}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Card <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {/* Remaining Laundries Banner */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-center">
              {loyaltyRecord.stampsUntilReward > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">
                    Only{" "}
                    <span className="text-primary font-extrabold text-sm">
                      {loyaltyRecord.stampsUntilReward}
                    </span>{" "}
                    more {loyaltyRecord.stampsUntilReward === 1 ? "laundry" : "laundries"} remaining!
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Complete {loyaltyRecord.stampsUntilReward} more wash to earn your next{" "}
                    <span className="font-semibold text-primary">{loyaltyRecord.rewardDescription}</span>.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-emerald-700">
                    🎉 Congratulations! Free Reward Ready!
                  </p>
                  <p className="text-[11px] text-slate-500">
                    You have earned a{" "}
                    <span className="font-semibold text-slate-800">{loyaltyRecord.rewardDescription}</span>. Claim it at the counter!
                  </p>
                </div>
              )}
            </div>

            {/* Stamp Progress Dots */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-500" /> Reward Progress
                </span>
                <span className="font-bold text-primary text-[11px]">
                  {loyaltyRecord.currentCycleStamps} / {loyaltyRecord.washesPerReward} Stamps
                </span>
              </div>
              <StampDots count={loyaltyRecord.currentCycleStamps} max={loyaltyRecord.washesPerReward} />
            </div>

            {/* Lifetime Stats */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="rounded-xl border border-border/80 bg-[#eff4ff]/60 p-2.5 text-center">
                <p className="text-sm font-bold text-slate-900">{loyaltyRecord.totalVisits}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Visits</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-[#eff4ff]/60 p-2.5 text-center">
                <p className="text-sm font-bold text-slate-900">{loyaltyRecord.totalKgWashed} kg</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Washed</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-[#eff4ff]/60 p-2.5 text-center">
                <p className="text-sm font-bold text-slate-900">{loyaltyRecord.rewardsRedeemed}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Claimed</p>
              </div>
            </div>

            {/* Member QR Code */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-border/80 bg-[#eff4ff]/60 p-3">
              <div className="bg-white p-1.5 rounded-xl shadow-xs border border-border/80 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                    `${protocol}://${host}/member/${loyaltyRecord.id}`
                  )}`}
                  alt={`Loyalty QR code for ${loyaltyRecord.name}`}
                  className="w-16 h-16 object-contain rounded"
                />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-primary" /> Member Pass
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Show this QR code at checkout to quickly collect stamps!
                </p>
              </div>
            </div>

            {/* Laundry Records / History */}
            {loyaltyRecord.laundryRecords.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-primary" /> Laundry Records
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {loyaltyRecord.laundryRecords.length} records
                  </span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {loyaltyRecord.laundryRecords.slice(0, 8).map((item, idx) => (
                    <div
                      key={`${item.ticketId}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-[#eff4ff]/40 p-2.5 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800 text-[11px]">{item.ticketId}</span>
                          <StatusBadge status={item.status} className="px-1.5 py-0 text-[10px]" />
                          {item.rewardUsed && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-800 px-1 py-0 text-[9px] font-bold">
                              <Gift className="w-2.5 h-2.5" /> Reward
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {item.washType} {item.weight > 0 ? `• ${item.weight} kg` : ""} {item.fee > 0 ? `• ₱${item.fee}` : ""}
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

        {/* Promotional Loyalty Program Banner (Shown only when loyalty enabled and customer is non-member) */}
        {isLoyaltyEnabled && !loyaltyRecord && (
          <section className="bg-white rounded-3xl border border-primary/20 p-5 shadow-[0_10px_30px_rgba(11,28,48,0.06)] text-center space-y-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Earn Free Laundries With Every Wash!</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Ask our staff to enroll your number into our Loyalty Program on your next visit to collect stamps and earn free washes.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
