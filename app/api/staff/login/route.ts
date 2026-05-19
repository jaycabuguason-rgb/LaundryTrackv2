import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { getRequestIp } from "@/lib/server/request-meta";
import { signInStaffWithIdentifier } from "@/lib/server/staff-repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      login?: string;
      password?: string;
    };

    const result = await signInStaffWithIdentifier(body.login ?? "", body.password ?? "");

    await createAuditLog({
      action: "login",
      summary: "Logged in",
      details: `Staff login successful for ${result.profile.username}.`,
      staffProfileId: result.profile.id,
      staffName: result.profile.fullName,
      staffRole: "staff",
      ipAddress: getRequestIp(request),
      metadata: {
        source: "api/staff/login",
      },
    }).catch(() => undefined);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign in.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
