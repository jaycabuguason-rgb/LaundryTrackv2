import { NextResponse } from "next/server";
import { getPublicLoyaltyMemberRecord } from "@/lib/server/loyalty-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = id?.trim();
    if (!cleanId) {
      return NextResponse.json({ error: "Member ID is required." }, { status: 400 });
    }

    const record = await getPublicLoyaltyMemberRecord(cleanId);
    if (!record) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    return NextResponse.json(
      { record },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch member status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
