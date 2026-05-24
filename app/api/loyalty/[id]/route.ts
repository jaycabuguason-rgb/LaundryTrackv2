import { NextResponse } from "next/server";
import { updateLoyaltyMember, deleteLoyaltyMember } from "@/lib/server/loyalty-repository";
import { getAuthErrorStatus, requireAuthRequest } from "@/lib/server/request-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthRequest(request);
    const { id } = await params;
    const raw = await request.json();
    const body: { name?: string; phone?: string; preferences?: string } = {};
    if (raw.name != null) body.name = String(raw.name).trim().slice(0, 100);
    if (raw.phone != null) body.phone = String(raw.phone).trim().slice(0, 20);
    if (raw.preferences != null) body.preferences = String(raw.preferences).trim().slice(0, 500);
    await updateLoyaltyMember(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to update member.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthRequest(_request);
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
    }
    await deleteLoyaltyMember(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to delete member.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
