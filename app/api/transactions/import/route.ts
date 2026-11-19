import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { getAuthErrorStatus, requireAdminRequest } from "@/lib/server/request-auth";
import { getRequestIp } from "@/lib/server/request-meta";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const VALID_STATUSES = new Set(["Received", "Washing", "Drying", "Ready", "Claimed", "Voided"]);

interface ImportRow {
  customerName: string;
  arrivalDate?: string;
  weight?: string | number;
  washType?: string;
  fee?: string | number;
  status?: string;
  phone?: string;
  addons?: string;
  notes?: string;
}

function generateTicketId(index: number, existingMax: number): string {
  return `TKT-${String(existingMax + index + 1).padStart(4, "0")}`;
}

function parseNumeric(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.\-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function normalizeStatus(value: string | undefined): string {
  if (!value) return "Received";
  // Try exact match first
  if (VALID_STATUSES.has(value)) return value;
  // Try case-insensitive match
  for (const valid of VALID_STATUSES) {
    if (valid.toLowerCase() === value.toLowerCase()) return valid;
  }
  return "Received";
}

const PH_OFFSET = "+08:00";

function normalizeDateTime(value: string | undefined | null): string {
  if (!value || !value.trim()) return new Date().toISOString();
  const trimmed = value.trim();

  // YYYY-MM-DD or YYYY/MM/DD with optional time
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ymdMatch) {
    const [, y, m, d, hh, mm, ss] = ymdMatch;
    const year = y;
    const month = m.padStart(2, "0");
    const day = d.padStart(2, "0");
    const hour = (hh ?? "00").padStart(2, "0");
    const min = (mm ?? "00").padStart(2, "0");
    const sec = (ss ?? "00").padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${min}:${sec}${PH_OFFSET}`;
  }

  // MM/DD/YYYY or DD/MM/YYYY with optional time
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmyMatch) {
    const [, p1, p2, y, hh, mm, ss] = dmyMatch;
    const year = y;
    const month = (parseInt(p1, 10) > 12 ? p2 : p1).padStart(2, "0");
    const day = (parseInt(p1, 10) > 12 ? p1 : p2).padStart(2, "0");
    const hour = (hh ?? "00").padStart(2, "0");
    const min = (mm ?? "00").padStart(2, "0");
    const sec = (ss ?? "00").padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${min}:${sec}${PH_OFFSET}`;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminRequest(request);
    const body = await request.json();

    if (!body || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: "Invalid request body. Expected { rows: [...] }." }, { status: 400 });
    }

    const rows: ImportRow[] = body.rows;
    if (rows.length === 0) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }
    if (rows.length > 5000) {
      return NextResponse.json({ error: "Cannot import more than 5,000 rows at once." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // Get the current max ticket number
    const { data: lastTicket } = await supabase
      .from("transactions")
      .select("ticket_id")
      .order("ticket_id", { ascending: false })
      .limit(1);

    const lastNumber = lastTicket?.[0]?.ticket_id
      ? parseInt(String(lastTicket[0].ticket_id).replace(/^TKT-/, ""), 10)
      : 0;
    const maxTicket = Number.isNaN(lastNumber) ? 0 : lastNumber;

    // Build insert records
    const skipped: number[] = [];
    const insertRecords: Array<Record<string, unknown>> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.customerName || !String(row.customerName).trim()) {
        skipped.push(i + 1);
        continue;
      }

      const rawStatus = row.status ? String(row.status).trim() : "";
      const status = rawStatus ? normalizeStatus(rawStatus) : "Claimed";
      const isPaid = status === "Claimed" || rawStatus.toLowerCase() === "paid";
      const arrivalTime = normalizeDateTime(row.arrivalDate);

      insertRecords.push({
        ticket_id: generateTicketId(insertRecords.length, maxTicket),
        customer_name: String(row.customerName).trim().slice(0, 100),
        phone_number: row.phone ? String(row.phone).trim().slice(0, 20) : null,
        wash_type: row.washType ? String(row.washType).trim().slice(0, 50) : "Regular",
        weight_kg: parseNumeric(row.weight) || null,
        fee: parseNumeric(row.fee),
        status,
        payment_status: isPaid ? "paid" : "unpaid",
        addons: row.addons ? String(row.addons).split(/[,;]/).map((a) => a.trim()).filter(Boolean) : [],
        special_instructions: row.notes ? String(row.notes).trim().slice(0, 500) : null,
        arrival_time: arrivalTime,
        claimed_at: status === "Claimed" ? arrivalTime : null,
      });
    }

    if (insertRecords.length === 0) {
      return NextResponse.json({
        success: true,
        importedCount: 0,
        skippedCount: skipped.length,
        skippedRows: skipped,
      });
    }

    // Insert in batches of 100
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    for (let i = 0; i < insertRecords.length; i += BATCH_SIZE) {
      const batch = insertRecords.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("transactions").insert(batch);
      if (error) {
        throw new Error(`Failed to import batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      }
      totalInserted += batch.length;
    }

    await createAuditLog({
      action: "other",
      summary: `Imported ${totalInserted} transactions from CSV`,
      details: `Imported by ${actor.name}. Total rows: ${rows.length}, Imported: ${totalInserted}, Skipped: ${skipped.length}`,
      staffProfileId: actor.id,
      staffName: actor.name,
      staffRole: actor.role,
      ipAddress: getRequestIp(request),
      metadata: {
        source: "api/transactions/import",
        totalRows: rows.length,
        importedCount: totalInserted,
        skippedCount: skipped.length,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      importedCount: totalInserted,
      skippedCount: skipped.length,
      skippedRows: skipped,
      ticketIds: insertRecords.map((r) => String(r.ticket_id)),
    });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to import transactions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireAdminRequest(request);
    const body = await request.json();

    if (!body || !Array.isArray(body.ticketIds) || body.ticketIds.length === 0) {
      return NextResponse.json({ error: "Invalid request body. Expected { ticketIds: string[] }." }, { status: 400 });
    }

    const ticketIds: string[] = body.ticketIds.map((t: unknown) => String(t).trim()).filter(Boolean);
    if (ticketIds.length === 0) {
      return NextResponse.json({ error: "No valid ticket IDs provided." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("transactions")
      .delete()
      .in("ticket_id", ticketIds);

    if (error) {
      throw new Error(`Failed to delete imported transactions: ${error.message}`);
    }

    await createAuditLog({
      action: "other",
      summary: `Undid import: removed ${ticketIds.length} transactions`,
      details: `Undo import executed by ${actor.name}. Total tickets removed: ${ticketIds.length}`,
      staffProfileId: actor.id,
      staffName: actor.name,
      staffRole: actor.role,
      ipAddress: getRequestIp(request),
      metadata: {
        source: "api/transactions/import/undo",
        ticketIdsCount: ticketIds.length,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      deletedCount: ticketIds.length,
    });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to undo import.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
