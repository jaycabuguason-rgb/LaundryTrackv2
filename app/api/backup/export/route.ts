import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { exportDatabaseBackup } from "@/lib/server/backup-repository";
import { getAuthErrorStatus, requireAdminRequest } from "@/lib/server/request-auth";
import { getRequestIp } from "@/lib/server/request-meta";

export async function GET(request: Request) {
  try {
    const actor = await requireAdminRequest(request);
    const backup = await exportDatabaseBackup(actor.name);

    await createAuditLog({
      action: "other",
      summary: "Database backup exported",
      details: `Exported by ${actor.name}. Records: ${Object.entries(backup.meta.tableRecordCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
      staffProfileId: actor.id,
      staffName: actor.name,
      staffRole: actor.role,
      ipAddress: getRequestIp(request),
      metadata: { source: "api/backup/export", counts: backup.meta.tableRecordCounts },
    }).catch(() => undefined);

    return NextResponse.json(backup);
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to export backup.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
