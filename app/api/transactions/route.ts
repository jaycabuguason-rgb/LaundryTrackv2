import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { createTransaction, listTransactions } from "@/lib/server/laundry-repository";
import { getAuthErrorStatus, getRequestActor, requireAuthRequest } from "@/lib/server/request-auth";
import { getRequestIp } from "@/lib/server/request-meta";
import type { CreateTransactionInput } from "@/lib/transaction-contracts";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function GET(request: Request) {
  try {
    await requireAuthRequest(request);
    const transactions = await listTransactions();
    return NextResponse.json({ transactions });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to load transactions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const VALID_STATUSES = new Set(["Received", "Washing", "Drying", "Ready", "Claimed", "Voided"]);
const VALID_PAYMENT_STATUSES = new Set(["unpaid", "paid"]);

export async function POST(request: Request) {
  try {
    const actor = await requireAuthRequest(request);
    const raw = await request.json();
    if (!raw || typeof raw.customerName !== "string" || !raw.customerName.trim()) {
      return NextResponse.json({ error: "Invalid input: customerName is required." }, { status: 400 });
    }
    if (!VALID_STATUSES.has(raw.status)) {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }
    if (!VALID_PAYMENT_STATUSES.has(raw.paymentStatus)) {
      return NextResponse.json({ error: "Invalid paymentStatus value." }, { status: 400 });
    }
    const body: CreateTransactionInput = {
      customerName: String(raw.customerName).trim().slice(0, 100),
      phone: String(raw.phone ?? "").trim().slice(0, 20),
      arrivalDateTime: String(raw.arrivalDateTime ?? "").trim(),
      washType: String(raw.washType ?? "").trim().slice(0, 50),
      weight: Number(raw.weight) || 0,
      fee: Number(raw.fee) || 0,
      status: raw.status,
      paymentStatus: raw.paymentStatus,
      addOns: Array.isArray(raw.addOns) ? raw.addOns.map((a: unknown) => String(a).trim().slice(0, 50)) : [],
      washInstructions: raw.washInstructions != null ? String(raw.washInstructions).trim().slice(0, 500) : undefined,
      dropOffDate: raw.dropOffDate != null ? String(raw.dropOffDate).trim() : undefined,
      eta: raw.eta != null ? String(raw.eta).trim() : null,
    };
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
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      const message = error instanceof Error ? error.message : "Unauthorized.";
      return NextResponse.json({ error: message }, { status: authStatus });
    }
    const message = error instanceof Error ? error.message : "Unable to create transaction.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
