import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { createTransaction, listTransactions } from "@/lib/server/laundry-repository";
import { getRequestActor } from "@/lib/server/request-auth";
import { getRequestIp } from "@/lib/server/request-meta";
import type { CreateTransactionInput } from "@/lib/transaction-contracts";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function GET() {
  try {
    const transactions = await listTransactions();
    return NextResponse.json({ transactions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load transactions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getRequestActor(request);
    const body = (await request.json()) as CreateTransactionInput;
    const transaction = await createTransaction(body);

    await createAuditLog({
      action: "transaction_created",
      summary: `Created transaction ${transaction.ticketId}`,
      details: `Customer: ${transaction.customerName} | Service: ${transaction.washType} | Fee: ${formatCurrency(transaction.fee)} | Status: ${transaction.status}`,
      ticketId: transaction.ticketId,
      transactionId: transaction.id,
      customerName: transaction.customerName,
      paymentStatus: transaction.paymentStatus,
      staffProfileId: actor?.id ?? null,
      staffName: actor?.name ?? null,
      staffRole: actor?.role ?? null,
      ipAddress: getRequestIp(request),
      metadata: {
        source: "api/transactions#create",
      },
    }).catch(() => undefined);

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create transaction.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
