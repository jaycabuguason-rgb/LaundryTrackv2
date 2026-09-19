import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { restoreDatabaseBackup, validateBackupPayload } from "@/lib/server/backup-repository";
import { getAuthErrorStatus, requireAdminRequest } from "@/lib/server/request-auth";
import { getRequestIp } from "@/lib/server/request-meta";

export async function POST(request: Request) {
  try {
    const actor = await requireAdminRequest(request);

    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Backup file exceeds 10MB limit." }, { status: 413 });
    }

    const raw = await request.json();

    if (!validateBackupPayload(raw)) {
      return NextResponse.json(
        { error: "Invalid backup file. The file does not match the LaundryTrack backup format." },
        { status: 400 },
      );
    }

    const result = await restoreDatabaseBackup(raw);

    await createAuditLog({
      action: "other",
      summary: "Database restored from backup",
      details: `Restored by ${actor.name}. Backup from ${raw.meta.exportedAt}. Settings: ${result.settingsRestored}, Service Types: ${result.serviceTypesRestored}, Add-ons: ${result.addOnsRestored}, Members: ${result.membersRestored}, Transactions: ${result.transactionsRestored}`,
      staffProfileId: actor.id,
      staffName: actor.name,
      staffRole: actor.role,
      ipAddress: getRequestIp(request),
      metadata: { source: "api/backup/restore", result, backupDate: raw.meta.exportedAt },
    }).catch(() => undefined);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to restore backup.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
