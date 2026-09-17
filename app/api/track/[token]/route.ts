import { NextResponse } from "next/server";

import { getPublicTrackingRecord } from "@/lib/server/laundry-repository";

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

    const record = await getPublicTrackingRecord(cleanToken);
    if (!record) {
      return NextResponse.json({ error: "Tracking record not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        status: record.status,
        eta: record.eta ?? null,
        updatedAt: record.updatedAt ?? null,
        paymentStatus: record.paymentStatus,
        balanceDue: record.balanceDue,
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

