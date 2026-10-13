import { NextResponse } from "next/server";

import { getPublicTrackingRecord } from "@/lib/server/laundry-repository";
import { getPublicLoyaltyMemberRecord, getLoyaltySettings } from "@/lib/server/loyalty-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const cleanToken = token?.trim();

    if (!cleanToken) {
      return NextResponse.json({ error: "Token is required." }, { status: 400 });
    }

    const [record, loyaltySettings] = await Promise.all([
      getPublicTrackingRecord(cleanToken),
      getLoyaltySettings().catch(() => null),
    ]);

    if (!record) {
      return NextResponse.json({ error: "Tracking record not found." }, { status: 404 });
    }

    const isLoyaltyEnabled = Boolean(loyaltySettings?.loyalty_enabled);
    const loyaltyRecord = (isLoyaltyEnabled && (record.customerPhone || record.customerName))
      ? await getPublicLoyaltyMemberRecord(record.customerPhone || record.customerName).catch(() => null)
      : null;

    return NextResponse.json(
      {
        status: record.status,
        eta: record.eta ?? null,
        updatedAt: record.updatedAt ?? null,
        claimedAt: record.claimedAt ?? null,
        paymentStatus: record.paymentStatus,
        balanceDue: record.balanceDue,
        totalAmount: record.totalAmount,
        paidAmount: record.paidAmount,
        loads: record.loads,
        enablePaymentOption: record.enablePaymentOption,
        loyaltyRecord,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch tracking status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

