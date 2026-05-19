import { NextResponse } from "next/server";

import { listAuditLogs } from "@/lib/server/audit-log-repository";
import { requireAdminRequest } from "@/lib/server/request-auth";

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const auditLogs = await listAuditLogs();
    return NextResponse.json({ auditLogs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load audit logs.";
    const status =
      message === "Missing authorization token." || message === "Your session is invalid or has expired."
        ? 401
        : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
