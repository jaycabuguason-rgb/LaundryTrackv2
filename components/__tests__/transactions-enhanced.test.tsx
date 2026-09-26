import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TransactionsPage from "@/components/pages/transactions";
import type { Transaction } from "@/lib/data";
import { persistPricingConfig, subscribeSettingsSync, LS_PRICING_CONFIG, DEFAULT_PRICING_CONFIG } from "@/lib/settings-store";

const testTransactions: Transaction[] = [
  {
    id: "tx-1",
    ticketId: "TKT-1001",
    customerName: "Alice Santos",
    phone: "09171234567",
    washType: "Regular",
    weight: 4.5,
    fee: 180,
    status: "Ready",
    paymentStatus: "paid",
    arrivalDateTime: "2026-09-09 10:00",
    dropOffDate: "2026-09-09",
    addOns: [],
  },
  {
    id: "tx-2",
    ticketId: "TKT-1002",
    customerName: "Bob Reyes",
    phone: "09189876543",
    washType: "Comforter",
    weight: 8.0,
    fee: 350,
    status: "Claimed",
    paymentStatus: "paid",
    arrivalDateTime: "2026-09-09 11:30",
    dropOffDate: "2026-09-09",
    claimedAt: "2026-09-09T14:30:00Z",
    addOns: [],
  },
  {
    id: "tx-3",
    ticketId: "TKT-1003",
    customerName: "Charlie Cruz",
    phone: "09191112222",
    washType: "Regular",
    weight: 5.0,
    fee: 200,
    status: "Voided",
    paymentStatus: "unpaid",
    voidReason: "Customer cancelled",
    arrivalDateTime: "2026-09-08 09:00",
    dropOffDate: "2026-09-08",
    voidedAt: "2026-09-08T10:00:00Z",
    addOns: [],
  },
];

describe("TransactionsPage Enhanced Features", () => {
  const onCreateTransaction = vi.fn();
  const onUpdateTransaction = vi.fn().mockImplementation(async (ticketId, updates) => {
    const existing = testTransactions.find((t) => t.ticketId === ticketId);
    return {
      transaction: {
        ...existing,
        ...updates,
      } as Transaction,
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("does not display text 'View' buttons on desktop transaction rows", () => {
    render(
      <TransactionsPage
        transactions={testTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    // Desktop row buttons should have Print and More Options (...), but no standalone 'View' button text
    const viewButtons = screen.queryAllByRole("button", { name: /^view$/i });
    expect(viewButtons.length).toBe(0);
  });

  it("hides Payment Status section in Edit Order when enablePaymentOption is false", () => {
    persistPricingConfig({
      ...DEFAULT_PRICING_CONFIG,
      enablePaymentOption: false,
    });

    render(
      <TransactionsPage
        transactions={testTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
        editTicketId="TKT-1001"
      />
    );

    // Edit modal should open for TKT-1001
    expect(screen.getByText(/Edit Ticket — TKT-1001/i)).toBeInTheDocument();

    // Payment Status heading and buttons in the Edit modal should NOT be present
    expect(screen.queryByRole("button", { name: /^Unpaid$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Paid$/i })).not.toBeInTheDocument();
  });

  it("shows Payment Status section in Edit Order when enablePaymentOption is true", () => {
    persistPricingConfig({
      ...DEFAULT_PRICING_CONFIG,
      enablePaymentOption: true,
    });

    render(
      <TransactionsPage
        transactions={testTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
        editTicketId="TKT-1001"
      />
    );

    expect(screen.getByText(/Edit Ticket — TKT-1001/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Unpaid$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Paid$/i })).toBeInTheDocument();
  });

  it("prevents editing Claimed and Voided tickets directly", async () => {
    const { rerender } = render(
      <TransactionsPage
        transactions={testTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
        editTicketId="TKT-1002" // Claimed
      />
    );

    // Edit modal should NOT open for claimed ticket
    expect(screen.queryByText(/Edit Ticket — TKT-1002/i)).not.toBeInTheDocument();

    rerender(
      <TransactionsPage
        transactions={testTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
        editTicketId="TKT-1003" // Voided
      />
    );

    // Edit modal should NOT open for voided ticket
    expect(screen.queryByText(/Edit Ticket — TKT-1003/i)).not.toBeInTheDocument();
  });

  it("supports settings synchronization via custom events", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeSettingsSync(callback);

    persistPricingConfig({
      ...DEFAULT_PRICING_CONFIG,
      enablePaymentOption: false,
    });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        key: LS_PRICING_CONFIG,
      })
    );

    unsubscribe();
  });
});
