import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { getRequestIp } from "@/lib/server/request-meta";
import type { UpdateStaffAccountInput } from "@/lib/staff-contracts";
import { getStaffAccountById, updateStaffAccount } from "@/lib/server/staff-repository";
import { requireAdminRequest } from "@/lib/server/request-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ staffId: string }> },
) {
  try {
    const actor = await requireAdminRequest(request);
    const { staffId } = await context.params;
    const previous = await getStaffAccountById(staffId);
    const body = (await request.json()) as UpdateStaffAccountInput;
    const staffAccount = await updateStaffAccount(staffId, body);

    const deactivated = previous?.isActive === true && staffAccount.isActive === false;
    const reactivated = previous?.isActive === false && staffAccount.isActive === true;
    const action = deactivated
      ? "staff_deactivated"
      : reactivated
        ? "staff_reactivated"
        : "staff_updated";
    const summary = deactivated
      ? `Deactivated staff account: ${staffAccount.username}`
      : reactivated
        ? `Reactivated staff account: ${staffAccount.username}`
        : `Updated staff account: ${staffAccount.username}`;

    await createAuditLog({
      action,
      summary,
      details: `Full Name: ${staffAccount.fullName} | Email: ${staffAccount.email} | Status: ${staffAccount.isActive ? "Active" : "Inactive"}`,
      staffProfileId: actor.id,
      staffName: actor.name,
      staffRole: actor.role,
      ipAddress: getRequestIp(request),
      metadata: {
        source: "api/staff#update",
        updated_staff_id: staffAccount.id,
      },
    }).catch(() => undefined);

    return NextResponse.json({ staffAccount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the staff account.";
    const status = message === "Missing authorization token." || message === "Your session is invalid or has expired." ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
