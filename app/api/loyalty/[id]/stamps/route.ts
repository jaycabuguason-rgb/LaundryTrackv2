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
    if (!Number.isInteger(stamps) || stamps < 1 || stamps > 100) {
      return NextResponse.json({ error: "Invalid stamps value." }, { status: 400 });
    }
    await addStampsToMember(id, stamps);
    return NextResponse.json({ success: true });
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
