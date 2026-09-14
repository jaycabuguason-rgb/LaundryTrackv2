import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TransactionsPage from "@/components/pages/transactions";
import { type Transaction } from "@/lib/data";

const mockTransactions: Transaction[] = [
  {
    id: "tx-100",
    ticketId: "TKT-0027",
    customerName: "fsafsf",
    phone: "09171234567",
    washType: "Regular",
    weight: 1,
    fee: 40,
    status: "Washing",
    paymentStatus: "unpaid",
    arrivalDateTime: "2026-09-09 10:00",
    dropOffDate: "2026-09-09",
    addOns: ["Fabcon"],
  },
];

describe("TransactionsPage Card Click Interaction", () => {
  it("opens laundry status and ticket details modal when clicking the transaction card/box directly without clicking View", () => {
    render(
      <TransactionsPage
        transactions={mockTransactions}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />
    );

    // Check modal is not open initially
    expect(screen.queryByText(/ticket details — TKT-0027/i)).not.toBeInTheDocument();

    // Find the transaction card box
    const cardBox = screen.getByRole("button", { name: /view details for ticket TKT-0027/i });
    expect(cardBox).toBeInTheDocument();

    // Click the card box directly (not the "View" button)
    fireEvent.click(cardBox);

    // Laundry status modal should be open with details and progress
    expect(screen.getByText(/ticket details — TKT-0027/i)).toBeInTheDocument();
    expect(screen.getByText(/status progress/i)).toBeInTheDocument();
    expect(screen.getAllByText("Washing").length).toBeGreaterThan(0);
  });
});
