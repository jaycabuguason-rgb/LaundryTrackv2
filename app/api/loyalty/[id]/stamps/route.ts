import { NextResponse } from "next/server";
import { addStampsToMember } from "@/lib/server/loyalty-repository";
import { getAuthErrorStatus, requireAuthRequest } from "@/lib/server/request-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthRequest(request);
    const { id } = await params;
    const raw = await request.json();
    const stamps = Number(raw?.stamps);
    const reason = raw?.reason ? String(raw.reason).trim() : "Manual entry";
    if (!Number.isInteger(stamps) || stamps < -100 || stamps > 100 || stamps === 0) {
    }
    const member = await addStampsToMember(id, stamps, reason);
    return NextResponse.json({ success: true, member });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to add stamps.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
