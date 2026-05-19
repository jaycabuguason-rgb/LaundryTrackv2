import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { getRequestIp } from "@/lib/server/request-meta";
import type { ResetStaffPasswordInput } from "@/lib/staff-contracts";
import { getStaffAccountById, resetStaffPassword } from "@/lib/server/staff-repository";
import { requireAdminRequest } from "@/lib/server/request-auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ staffId: string }> },
) {
  try {
    const actor = await requireAdminRequest(request);
    const { staffId } = await context.params;
    const staffAccount = await getStaffAccountById(staffId);
    const body = (await request.json()) as ResetStaffPasswordInput;
    await resetStaffPassword(staffId, body.password);

    await createAuditLog({
      action: "staff_password_reset",
      summary: `Reset password for ${staffAccount?.username ?? "staff account"}`,
      details: `Password reset completed for ${staffAccount?.fullName ?? "Unknown staff member"}.`,
      staffProfileId: actor.id,
      staffName: actor.name,
      staffRole: actor.role,
      ipAddress: getRequestIp(request),
      metadata: {
        source: "api/staff#password-reset",
        updated_staff_id: staffId,
      },
    }).catch(() => undefined);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset the staff password.";
    const status = message === "Missing authorization token." || message === "Your session is invalid or has expired." ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
