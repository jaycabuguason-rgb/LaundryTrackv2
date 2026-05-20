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
    const raw = await request.json();
    if (!raw || typeof raw.fullName !== "string" || !raw.fullName.trim()) {
      return NextResponse.json({ error: "Invalid input: fullName is required." }, { status: 400 });
    }
    if (typeof raw.email !== "string" || !raw.email.trim()) {
      return NextResponse.json({ error: "Invalid input: email is required." }, { status: 400 });
    }
    if (typeof raw.username !== "string" || !raw.username.trim()) {
      return NextResponse.json({ error: "Invalid input: username is required." }, { status: 400 });
    }
    const body: UpdateStaffAccountInput = {
      fullName: String(raw.fullName).trim().slice(0, 100),
      email: String(raw.email).trim().slice(0, 200),
      username: String(raw.username).trim().slice(0, 50),
      isActive: Boolean(raw.isActive),
      phoneNumber: raw.phoneNumber != null ? String(raw.phoneNumber).trim().slice(0, 20) : undefined,
    };
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
