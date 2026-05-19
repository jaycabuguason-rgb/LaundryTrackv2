import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { getRequestIp } from "@/lib/server/request-meta";
import type { CreateStaffAccountInput } from "@/lib/staff-contracts";
import { createStaffAccount, listStaffAccounts } from "@/lib/server/staff-repository";
import { requireAdminRequest } from "@/lib/server/request-auth";

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const staff = await listStaffAccounts();
    return NextResponse.json({ staff });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load staff accounts.";
    const status = message === "Missing authorization token." || message === "Your session is invalid or has expired." ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminRequest(request);
    const body = (await request.json()) as CreateStaffAccountInput;
    const staffAccount = await createStaffAccount(body);

    await createAuditLog({
      action: "staff_created",
      summary: `Created staff account: ${staffAccount.username}`,
      details: `Full Name: ${staffAccount.fullName} | Email: ${staffAccount.email} | Status: ${staffAccount.isActive ? "Active" : "Inactive"}`,
      staffProfileId: actor.id,
      staffName: actor.name,
      staffRole: actor.role,
      ipAddress: getRequestIp(request),
      metadata: {
        source: "api/staff#create",
        created_staff_id: staffAccount.id,
      },
    }).catch(() => undefined);

    return NextResponse.json({ staffAccount }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create the staff account.";
    const status = message === "Missing authorization token." || message === "Your session is invalid or has expired." ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
