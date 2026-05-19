import { NextResponse } from "next/server";
import { updateLoyaltyMember, deleteLoyaltyMember } from "@/lib/server/loyalty-repository";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as { name?: string; phone?: string; preferences?: string };
    await updateLoyaltyMember(params.id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update member.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteLoyaltyMember(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete member.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
