import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  Star,
  Award,
  Package,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  Flame,
  CheckCircle2,
  Calendar,
  Gift,
} from "lucide-react";

import { getPublicLoyaltyMemberRecord } from "@/lib/server/loyalty-repository";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StampDots({ count, max = 7 }: { count: number; max?: number }) {
  const effectiveCount = Math.min(count, max);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < effectiveCount;
        return (
          <div
            key={i}
            className={cn(
              "flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl border-2 text-xs font-bold transition-all shadow-xs",
              filled
                ? "border-primary bg-primary text-primary-foreground scale-105 shadow-md shadow-primary/20"
                : "border-dashed border-border bg-muted/30 text-muted-foreground"
            )}
          >
            {filled ? <Star className="h-5 w-5 fill-current" /> : i + 1}
          </div>
        );
      })}
    </div>
  );
}

export default async function MemberLoyaltyStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await getPublicLoyaltyMemberRecord(id);

  if (!record) {
    notFound();
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const memberUrl = `${protocol}://${host}/member/${record.id}`;
  const memberQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    memberUrl
  )}`;

  const formattedMemberId = `MEM-${String(record.id).padStart(4, "0")}`;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.08),_transparent_32%),linear-gradient(180deg,var(--background)_0%,hsl(35,28%,92%)_100%)] dark:bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-xl space-y-6">
        {/* Header with Logo and Shop Name */}
        <div className="flex flex-col items-center gap-2 text-center">
          {record.shopProfile.logoDataUrl && (
            <img
              src={record.shopProfile.logoDataUrl}
              alt={`${record.shopProfile.shopName} logo`}
              className="h-14 w-auto object-contain"
            />
          )}
          <h2 className="text-xl font-bold text-foreground">{record.shopProfile.shopName}</h2>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Loyalty Rewards Program
          </p>
          {record.shopProfile.tagline && (
            <p className="text-xs text-muted-foreground">{record.shopProfile.tagline}</p>
          )}
        </div>

        {/* Member Digital Loyalty Card & QR */}
        <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-background/95 p-6 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-sm">
                {getInitials(record.name)}
              </div>
              <div>
                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 mb-1">
                  VIP Member
                </span>
                <h1 className="text-xl font-bold tracking-tight text-foreground">{record.name}</h1>
                <p className="font-mono text-xs font-semibold text-muted-foreground">
                  {formattedMemberId}
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p className="font-medium">Member Since</p>
              <p className="font-semibold text-foreground">{record.dateJoined}</p>
            </div>
          </div>

          {/* Member QR Code */}
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-border bg-muted/20 p-5 text-center">
            <div className="rounded-2xl border border-border bg-white p-3 shadow-xs">
              <img
                src={memberQrUrl}
                alt={`Member QR for ${record.name}`}
                width={180}
                height={180}
                className="rounded-lg"
              />
            </div>
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-primary">
              Member Loyalty QR Code
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Show this code to shop staff during drop-off or pickup to earn reward stamps.
            </p>
          </div>
        </section>

        {/* Current Reward Progress Card */}
        <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-bold text-foreground">Reward Progress</h2>
            </div>
            <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
              {record.currentCycleStamps} / {record.washesPerReward} Stamps
            </span>
          </div>

          {/* Remaining Laundries Banner */}
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
            {record.stampsUntilReward > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground sm:text-base">
                  Only{" "}
                  <span className="text-primary font-extrabold text-lg">
                    {record.stampsUntilReward}
                  </span>{" "}
                  more {record.stampsUntilReward === 1 ? "laundry" : "laundries"} remaining!
                </p>
                <p className="text-xs text-muted-foreground">
                  Complete {record.stampsUntilReward} more wash to earn your next{" "}
                  <span className="font-semibold text-primary">{record.rewardDescription}</span>.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 sm:text-base">
                  🎉 Congratulations! Free Reward Ready!
                </p>
                <p className="text-xs text-muted-foreground">
                  You have earned a{" "}
                  <span className="font-semibold text-foreground">{record.rewardDescription}</span>.
                  Claim it on your next visit!
                </p>
              </div>
            )}
          </div>

          {/* Stamp Dots */}
          <div className="mt-5">
            <StampDots count={record.currentCycleStamps} max={record.washesPerReward} />
          </div>

          {/* Progress Bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground">
              <span>Current Cycle</span>
              <span>{record.progressPct}% towards reward</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${record.progressPct}%` }}
              />
            </div>
          </div>

          {/* Member Lifetime Stats */}
          <div className="mt-6 grid grid-cols-3 gap-2.5 pt-4 border-t border-border/60 text-center">
            <div className="rounded-xl bg-muted/30 p-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Visits
              </p>
              <p className="mt-1 text-base font-bold text-foreground">{record.totalVisits}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Washed
              </p>
              <p className="mt-1 text-base font-bold text-foreground">{record.totalKgWashed} kg</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Rewards
              </p>
              <p className="mt-1 text-base font-bold text-primary">{record.rewardsRedeemed}</p>
            </div>
          </div>
        </section>

        {/* Laundry Records & History */}
        <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">Laundry Records</h2>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {record.laundryRecords.length} record{record.laundryRecords.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {record.laundryRecords.length > 0 ? (
              record.laundryRecords.map((item, idx) => (
                <div
                  key={`${item.ticketId}-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-border/70 bg-muted/20 p-3.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">
                        {item.ticketId}
                      </span>
                      <StatusBadge status={item.status} className="px-2 py-0 text-[10px]" />
                      {item.rewardUsed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                          <Gift className="w-2.5 h-2.5" /> Reward Wash
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.washType}</span>
                      {item.weight > 0 && <span>• {item.weight} kg</span>}
                      {item.fee > 0 && <span>• ₱{item.fee}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{item.date}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No laundry visits recorded yet.
              </div>
            )}
          </div>
        </section>

        {/* Claimed Rewards History */}
        <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">Recent Rewards Claimed</h2>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {record.rewardHistory.length} claimed
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {record.rewardHistory.length > 0 ? (
              record.rewardHistory.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{item.reward}</p>
                      <p className="text-[11px] text-muted-foreground">Redeemed on {item.date}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900">
                    <CheckCircle2 className="h-3 w-3" /> Claimed
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No rewards claimed yet. Complete {record.stampsUntilReward} more{" "}
                {record.stampsUntilReward === 1 ? "laundry" : "laundries"} to unlock your first reward!
              </div>
            )}
          </div>
        </section>

        {/* Shop Contact Card */}
        <section className="rounded-3xl border border-border bg-background p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">{record.shopProfile.shopName}</p>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            {record.shopProfile.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                <span>{record.shopProfile.address}</span>
              </div>
            )}
            {record.shopProfile.contactNumber && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                <a href={`tel:${record.shopProfile.contactNumber}`} className="hover:text-primary">
                  {record.shopProfile.contactNumber}
                </a>
              </div>
            )}
            {record.shopProfile.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                <a href={`mailto:${record.shopProfile.email}`} className="hover:text-primary">
                  {record.shopProfile.email}
                </a>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
