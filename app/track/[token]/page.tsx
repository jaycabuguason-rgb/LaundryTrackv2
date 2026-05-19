import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { CheckCircle2, Clock3, MapPin, Phone, Mail, Shirt, ShieldCheck, Package } from "lucide-react";

import { formatReadableDateTime } from "@/lib/date-format";
import { statusColors, statusOrder } from "@/lib/data";
import { getPublicTrackingRecord } from "@/lib/server/laundry-repository";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function StatusStepper({ status }: { status: string }) {
  const activeIndex = statusOrder.indexOf(status as (typeof statusOrder)[number]);

  if (status === "Voided") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        This order was voided. Please contact the shop for assistance.
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2 overflow-x-auto pb-1">
      {statusOrder.map((step, index) => {
        const completed = index < activeIndex;
        const current = index === activeIndex;
        return (
          <div key={step} className="flex min-w-[64px] flex-1 items-start">
            <div className="flex w-full flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                  completed || current
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-center text-[11px] leading-tight",
                  current ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {step}
              </span>
            </div>
            {index < statusOrder.length - 1 && (
              <div
                className={cn(
                  "mt-4 h-0.5 flex-1",
                  index < activeIndex ? "bg-primary" : "bg-border",
                )}
              />
            )}
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
  const record = await getPublicTrackingRecord(token);
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const trackingUrl = `${protocol}://${host}/track/${token}`;
  const pickupQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(trackingUrl)}`;

  if (!record) {
    notFound();
  }

  const finalMessage =
    record.status === "Claimed"
      ? "This laundry order has already been claimed."
      : record.status === "Ready"
        ? "Ready for pickup."
        : "Your laundry is still in progress.";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-8 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header with Logo and Shop Name */}
        <div className="flex flex-col items-center gap-3 text-center">
          {record.shopProfile.logoDataUrl && (
            <img
              src={record.shopProfile.logoDataUrl}
              alt={`${record.shopProfile.shopName} logo`}
              className="h-16 w-auto object-contain"
            />
          )}
          <h2 className="text-xl font-bold text-foreground">{record.shopProfile.shopName}</h2>
          {record.shopProfile.tagline && (
            <p className="text-xs text-muted-foreground">{record.shopProfile.tagline}</p>
          )}
        </div>

        {/* Ticket Info Card */}
        <section className="rounded-3xl border border-border/80 bg-background/95 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Ticket ID
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">{record.ticketId}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Drop-off: {record.dropOffTime}
              </p>
              {record.eta && (
                <p className="mt-1 text-sm font-medium text-foreground">
                  Estimated pickup: {formatReadableDateTime(record.eta)}
                </p>
              )}
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                statusColors[record.status],
              )}
            >
              {record.status}
            </span>
          </div>

          {/* Status Timeline */}
          <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status Timeline
            </p>
            <StatusStepper status={record.status} />
          </div>
        </section>

        {/* Laundry Details Card */}
        <section className="rounded-3xl border border-border bg-background p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Package className="h-4 w-4 text-primary" />
            Laundry Details
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/30 px-3 py-2">
              <dt className="text-muted-foreground">Weight</dt>
              <dd className="text-right font-medium">{record.weight} kg</dd>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/30 px-3 py-2">
              <dt className="text-muted-foreground">Wash Type</dt>
              <dd className="text-right font-medium">{record.washType}</dd>
            </div>
            {record.addOns && record.addOns.length > 0 && (
              <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/30 px-3 py-2">
                <dt className="text-muted-foreground">Add-ons</dt>
                <dd className="text-right font-medium">{record.addOns.join(", ")}</dd>
              </div>
            )}
            {record.washInstructions && (
              <div className="rounded-lg bg-muted/30 px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Special Instructions</dt>
                <dd className="mt-1 text-sm font-medium">{record.washInstructions}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Payment Card */}
        <section className="rounded-3xl border border-border bg-background p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Shirt className="h-4 w-4 text-primary" />
            Payment
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                  record.paymentStatus === "paid"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                )}
              >
                {record.paymentStatus === "paid" ? "Paid" : "Unpaid"}
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Balance Due
              </p>
              <p className="text-2xl font-bold text-primary">
                ₱{record.balanceDue.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
            Online payment is not available here. Please settle any unpaid balance at the shop during pickup.
          </div>
        </section>

        {/* Pickup Instructions Card */}
        <section className="rounded-3xl border border-border bg-background p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Pickup Instructions
          </div>
          <div className="mt-4 space-y-4">
            {/* Shop Contact Info */}
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-sm font-semibold text-foreground">{record.shopProfile.shopName}</p>
              <div className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{record.shopProfile.address}</span>
                </div>
                {record.shopProfile.contactNumber && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 shrink-0 text-primary" />
                    <a href={`tel:${record.shopProfile.contactNumber}`} className="text-muted-foreground hover:text-primary">
                      {record.shopProfile.contactNumber}
                    </a>
                  </div>
                )}
                {record.shopProfile.email && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    <a href={`mailto:${record.shopProfile.email}`} className="text-muted-foreground hover:text-primary">
                      {record.shopProfile.email}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Before Pickup */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-foreground">Before Pickup</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {record.shopProfile.pickupInstructions}
              </p>
            </div>

            {/* Footer Message */}
            {record.shopProfile.receiptFooter && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {record.shopProfile.receiptFooter}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Pickup QR Code - Only show when Ready */}
        {record.status === "Ready" && (
          <section className="rounded-3xl border border-border bg-background p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Pickup QR Code
            </div>
            <div className="mt-4 flex flex-col items-center rounded-2xl border border-border bg-muted/20 p-5 text-center">
              <img
                src={pickupQrUrl}
                alt={`Pickup QR code for ${record.ticketId}`}
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
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Claim Code
                </p>
                <p className="mt-1 break-all font-mono text-sm font-semibold text-foreground">
                  {token}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  If the staff does not scan the QR code, they can paste this claim code into Claim Verification and your transaction will appear automatically.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
