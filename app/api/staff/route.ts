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
    if (typeof raw.password !== "string" || raw.password.length < 8) {
      return NextResponse.json({ error: "Invalid input: password must be at least 8 characters." }, { status: 400 });
    }
    const body: CreateStaffAccountInput = {
      fullName: String(raw.fullName).trim().slice(0, 100),
      email: String(raw.email).trim().slice(0, 200),
      username: String(raw.username).trim().slice(0, 50),
      password: String(raw.password),
      phoneNumber: raw.phoneNumber != null ? String(raw.phoneNumber).trim().slice(0, 20) : undefined,
    };
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
