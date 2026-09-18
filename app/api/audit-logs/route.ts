import { NextResponse } from "next/server";

import { createAuditLog, listAuditLogs } from "@/lib/server/audit-log-repository";
import { getAuthErrorStatus, requireAuthRequest } from "@/lib/server/request-auth";
import { getRequestIp } from "@/lib/server/request-meta";

export async function GET(request: Request) {
  try {
    await requireAuthRequest(request);
    const auditLogs = await listAuditLogs();
    return NextResponse.json({ auditLogs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load audit logs.";
    const status = getAuthErrorStatus(error) || (
      message === "Missing authorization token." || message === "Your session is invalid or has expired."
        ? 401
        : 403
    );
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAuthRequest(request);
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const {
      action,
      ticketId,
      summary,
      details,
      customerName,
      paymentStatus,
      correlationId,
      metadata = {},
    } = body as Record<string, unknown>;

    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "Action is required." }, { status: 400 });
    }

    const mergedMetadata: Record<string, unknown> = {
      ...(typeof metadata === "object" && metadata ? metadata : {}),
      ...(correlationId && typeof correlationId === "string" ? { correlationId } : {}),
      source: "api/audit-logs#post",
    };

    const auditLog = await createAuditLog({
      action: String(action).trim(),
      summary: summary && typeof summary === "string" ? summary.trim() : `${action} event recorded`,
      details: details && typeof details === "string" ? details.trim() : "",
      ticketId: ticketId && typeof ticketId === "string" ? ticketId.trim() : null,
      customerName: customerName && typeof customerName === "string" ? customerName.trim() : null,
      paymentStatus: (paymentStatus as import("@/lib/data").PaymentStatus) || null,
      staffProfileId: actor.id,
      staffName: actor.name,
      staffRole: actor.role,
      ipAddress: getRequestIp(request),
      metadata: mergedMetadata,
    });

    return NextResponse.json({ auditLog }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record audit log.";
    const status = getAuthErrorStatus(error) || 500;
    return NextResponse.json({ error: message }, { status });
  }
}
