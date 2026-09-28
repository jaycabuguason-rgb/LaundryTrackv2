import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TransactionsPage from "@/components/pages/transactions";
import type { Transaction } from "@/lib/data";

const mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    ticketId: "TKT-0027",
    customerName: "Alice Santos",
    phone: "09171234567",
    washType: "Regular",
    weight: 4.5,
    fee: 180,
    status: "Washing",
    paymentStatus: "unpaid",
    arrivalDateTime: "2026-09-09 10:00",
    dropOffDate: "2026-09-09",
    addOns: ["Fabcon"],
  },
  {
    id: "tx-void",
    ticketId: "TKT-0099",
    customerName: "Void Customer",
    phone: "09181112222",
    washType: "Comforter",
    weight: 5.0,
    fee: 250,
    status: "Voided",
    paymentStatus: "unpaid",
    arrivalDateTime: "2026-09-09 11:00",
    dropOffDate: "2026-09-09",
    voidReason: "Customer changed mind",
    voidedAt: "2026-09-09 11:30",
  },
];

describe("TransactionsPage Admin Delete Record Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render Delete Record option when role is staff in mobile actions", async () => {
    render(
      <TransactionsPage
        transactions={mockTransactions}
        role="staff"
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
        onDeleteTransaction={vi.fn()}
      />
    );

    // Tap card to expand
    const card27 = screen.getByLabelText(/Ticket #TKT-0027/i);
    fireEvent.click(card27);

    // Click more options
    const moreBtn = screen.getByRole("button", { name: /more options/i });
    fireEvent.click(moreBtn);

    expect(screen.getByText("Transaction Quick Menu")).toBeInTheDocument();
    expect(screen.queryByText(/Delete Record/i)).not.toBeInTheDocument();
  });

  it("renders Delete Record option, dismisses modal immediately on click, and triggers onDeleteTransaction in background", async () => {
    let resolveDeletePromise!: () => void;
    const deletePromise = new Promise<void>((resolve) => {
      resolveDeletePromise = resolve;
    });
    const onDeleteMock = vi.fn().mockImplementation(() => deletePromise);

    render(
      <TransactionsPage
        transactions={mockTransactions}
        role="admin"
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
        onDeleteTransaction={onDeleteMock}
      />
    );

    // Tap card to expand
    const card27 = screen.getByLabelText(/Ticket #TKT-0027/i);
    fireEvent.click(card27);

    // Click more options to open drawer
    const moreBtn = screen.getByRole("button", { name: /more options/i });
    fireEvent.click(moreBtn);

    // Should see Delete Record button
    const deleteBtn = await screen.findByRole("button", { name: /Delete Record/i });
    expect(deleteBtn).toBeInTheDocument();

    // Click Delete Record
    fireEvent.click(deleteBtn);

    // Confirmation dialog should appear
    expect(await screen.findByText(/Delete Transaction Record/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to permanently delete transaction/i)).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", { name: /Permanently Delete/i });
    fireEvent.click(confirmBtn);

    // MODAL MUST DISMISS IMMEDIATELY without waiting for deletePromise!
    await waitFor(() => {
      expect(screen.queryByText(/Are you sure you want to permanently delete transaction/i)).not.toBeInTheDocument();
    });

    // Check that onDeleteTransaction was called
    expect(onDeleteMock).toHaveBeenCalledWith("TKT-0027");

    // Resolve the background promise
    resolveDeletePromise();
  });

  it("allows deleting voided transactions from the voided section", async () => {
    const onDeleteMock = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionsPage
        transactions={mockTransactions}
        role="admin"
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
        onDeleteTransaction={onDeleteMock}
      />
    );

    // Switch to Voided tab
    const voidedTabs = screen.getAllByRole("tab", { name: /voided/i });
    fireEvent.click(voidedTabs[0]);

    // Find voided card
    const cardVoid = screen.getByLabelText(/Ticket #TKT-0099/i);
    fireEvent.click(cardVoid);

    // Click more options
    const moreBtn = screen.getByRole("button", { name: /more options/i });
    fireEvent.click(moreBtn);

    // Should see Delete Record button
    const deleteBtn = await screen.findByRole("button", { name: /Delete Record/i });
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", { name: /Permanently Delete/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onDeleteMock).toHaveBeenCalledWith("TKT-0099");
    });
  });
});
