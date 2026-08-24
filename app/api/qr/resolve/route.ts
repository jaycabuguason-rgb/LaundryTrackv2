import { NextResponse } from "next/server";

import { resolveScannedTransaction } from "@/lib/server/laundry-repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { value?: string };
    const value = body.value?.trim();
    if (!value) {
      return NextResponse.json({ error: "A scanned QR value is required." }, { status: 400 });
    }

    const transaction = await resolveScannedTransaction(value);
    return NextResponse.json({
      ticketId: transaction?.ticketId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve QR code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
