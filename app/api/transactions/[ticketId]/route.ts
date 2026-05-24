import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { updateTransaction } from "@/lib/server/laundry-repository";
import { getAuthErrorStatus, requireAuthRequest } from "@/lib/server/request-auth";
import { getRequestIp } from "@/lib/server/request-meta";
import type { UpdateTransactionInput } from "@/lib/transaction-contracts";

const VALID_STATUSES = new Set(["Received", "Washing", "Drying", "Ready", "Claimed", "Voided"]);
const VALID_PAYMENT_STATUSES = new Set(["unpaid", "paid"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    const actor = await requireAuthRequest(request);
    const { ticketId } = await context.params;
    const raw = await request.json();
    if (raw.status !== undefined && !VALID_STATUSES.has(raw.status)) {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }
    if (raw.paymentStatus !== undefined && !VALID_PAYMENT_STATUSES.has(raw.paymentStatus)) {
      return NextResponse.json({ error: "Invalid paymentStatus value." }, { status: 400 });
    }
    const body: UpdateTransactionInput = {};
    if (raw.status !== undefined) body.status = raw.status;
    if (raw.paymentStatus !== undefined) body.paymentStatus = raw.paymentStatus;
    if (raw.washInstructions !== undefined) body.washInstructions = String(raw.washInstructions).trim().slice(0, 500);
    if (raw.eta !== undefined) body.eta = raw.eta != null ? String(raw.eta).trim() : null;
    if (raw.voidReason !== undefined) body.voidReason = raw.voidReason != null ? String(raw.voidReason).trim().slice(0, 500) : null;
    const transaction = await updateTransaction(ticketId, body);

    const statusChanged = Boolean(body.status);
    const summary = statusChanged
      ? `Updated status of ${transaction.ticketId} to ${transaction.status}`
      : `Updated transaction ${transaction.ticketId}`;
    const details = statusChanged
      ? `New status: ${transaction.status} | Payment: ${transaction.paymentStatus}`
      : [
          body.paymentStatus ? `Payment updated to ${transaction.paymentStatus}` : null,
          body.eta !== undefined ? `ETA: ${transaction.eta ?? "none"}` : null,
          body.washInstructions !== undefined ? `Instructions updated` : null,
          body.voidReason !== undefined ? `Void reason: ${body.voidReason ?? "cleared"}` : null,
        ].filter(Boolean).join(" | ") || "Transaction details updated.";

    void createAuditLog({
      action: statusChanged ? "status_changed" : "transaction_updated",
      summary,
      details,
      ticketId: transaction.ticketId,
      transactionId: transaction.id,
      customerName: transaction.customerName,
      paymentStatus: transaction.paymentStatus,
      staffProfileId: actor?.id ?? null,
      staffName: actor?.name ?? null,
      staffRole: actor?.role ?? null,
      ipAddress: getRequestIp(request),
      metadata: {
        source: "api/transactions#update",
      },
    }).catch(() => undefined);

    return NextResponse.json({ transaction });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }

    if (error instanceof Error && error.message.includes("was not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unable to update transaction.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
