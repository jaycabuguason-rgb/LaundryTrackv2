import { NextResponse } from "next/server";
import { redeemMemberReward } from "@/lib/server/loyalty-repository";
import { getAuthErrorStatus, requireAuthRequest } from "@/lib/server/request-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuthRequest(request);
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
    }

    const raw = await request.json().catch(() => ({}));
    const rewardDescription = typeof raw?.rewardDescription === "string" ? raw.rewardDescription.trim() : undefined;

    const member = await redeemMemberReward(id, rewardDescription, {
      name: actor?.name,
      role: actor?.role,
      id: actor?.id,
    });

    return NextResponse.json({ success: true, member });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to redeem reward.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

