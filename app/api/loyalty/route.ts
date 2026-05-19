import { NextResponse } from "next/server";
import { listLoyaltyMembers, createLoyaltyMember } from "@/lib/server/loyalty-repository";

export async function GET() {
  try {
    const members = await listLoyaltyMembers();
    return NextResponse.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load loyalty members.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name: string; phone?: string; preferences?: string };
    const member = await createLoyaltyMember(body);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create loyalty member.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
