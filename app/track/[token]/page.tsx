import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { CustomerTrackingView } from "@/components/customer-tracking-view";
import { getPublicTrackingRecord } from "@/lib/server/laundry-repository";
import { getPublicLoyaltyMemberRecord, getLoyaltySettings } from "@/lib/server/loyalty-repository";

export const dynamic = "force-dynamic";

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
    <div className="min-h-screen force-light bg-[#f7f6f4] py-6 px-3 sm:px-6 text-slate-800 antialiased">
      {/* Constrained max width perfectly suited for Mobile viewing */}
      <main className="max-w-[480px] mx-auto space-y-4" data-purpose="mobile-tracking-container">
        {/* BEGIN: BrandHeader */}
        <header className="text-center pt-2 pb-2" data-purpose="shop-brand-header">
          {/* Centered Shop Avatar/Badge */}
          <div className="inline-flex items-center justify-center p-1.5 bg-white rounded-2xl shadow-sm border border-stone-200/80 mb-2.5">
            {record.shopProfile.logoDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={record.shopProfile.logoDataUrl}
                alt={`${record.shopProfile.shopName} Shop Logo`}
                className="w-14 h-14 object-cover rounded-xl"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg">
                {record.shopProfile.shopName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-snug">
            {record.shopProfile.shopName}
          </h1>
          <p className="text-xs text-slate-500 font-medium tracking-wide mt-0.5">
            Powered by <span className="text-purple-700 font-semibold">LaundryTrack</span>
          </p>
        </header>
        {/* END: BrandHeader */}

        {/* Dynamic Live Customer Tracking & Live Loyalty Section */}
        <CustomerTrackingView
          initialRecord={record}
          token={token}
          pickupQrUrl={pickupQrUrl}
          initialLoyaltyRecord={loyaltyRecord}
          isLoyaltyEnabled={isLoyaltyEnabled}
          memberBaseUrl={`${protocol}://${host}/member`}
        />
      </main>
    </div>
  );
}
