import { NextResponse } from "next/server";
import { addStampsToMember } from "@/lib/server/loyalty-repository";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as { stamps: number };
    await addStampsToMember(params.id, body.stamps);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add stamps.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
