import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { getTransactionByTicketId, updateTransaction } from "@/lib/server/laundry-repository";
import { getRequestActor } from "@/lib/server/request-auth";
import { getRequestIp } from "@/lib/server/request-meta";
import type { UpdateTransactionInput } from "@/lib/transaction-contracts";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    const actor = await getRequestActor(request);
    const { ticketId } = await context.params;
    const previous = await getTransactionByTicketId(ticketId);
    const body = (await request.json()) as UpdateTransactionInput;
    const transaction = await updateTransaction(ticketId, body);

    const statusChanged = Boolean(body.status && previous?.status !== transaction.status);
    const summary = statusChanged
      ? `Updated status of ${transaction.ticketId} to ${transaction.status}`
      : `Updated transaction ${transaction.ticketId}`;
    const details = statusChanged
      ? `Previous status: ${previous?.status ?? "Unknown"} | New status: ${transaction.status} | Payment: ${transaction.paymentStatus}`
      : [
          body.paymentStatus ? `Payment: ${previous?.paymentStatus ?? "Unknown"} -> ${transaction.paymentStatus}` : null,
          body.eta !== undefined ? `ETA: ${transaction.eta ?? "none"}` : null,
          body.washInstructions !== undefined ? `Instructions updated` : null,
          body.voidReason !== undefined ? `Void reason: ${body.voidReason ?? "cleared"}` : null,
        ].filter(Boolean).join(" | ") || "Transaction details updated.";

    await createAuditLog({
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
    const message = error instanceof Error ? error.message : "Unable to update transaction.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
