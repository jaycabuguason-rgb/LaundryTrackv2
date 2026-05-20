import { NextResponse } from "next/server";
import { listLoyaltyMembers, createLoyaltyMember } from "@/lib/server/loyalty-repository";
import { getAuthErrorStatus, requireAuthRequest } from "@/lib/server/request-auth";

export async function GET(request: Request) {
  try {
    await requireAuthRequest(request);
    const members = await listLoyaltyMembers();
    return NextResponse.json({ members });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to load loyalty members.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthRequest(request);
    const raw = await request.json();
    if (!raw || typeof raw.name !== "string" || !raw.name.trim()) {
      return NextResponse.json({ error: "Invalid input: name is required." }, { status: 400 });
    }
    const body = {
      name: String(raw.name).trim().slice(0, 100),
      phone: raw.phone != null ? String(raw.phone).trim().slice(0, 20) : undefined,
      preferences: raw.preferences != null ? String(raw.preferences).trim().slice(0, 500) : undefined,
    };
    const member = await createLoyaltyMember(body);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to create loyalty member.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
