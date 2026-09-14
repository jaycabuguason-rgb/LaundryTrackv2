import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProcessingPage from "@/components/pages/processing";
import { type Transaction } from "@/lib/data";

const mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    ticketId: "TKT-0030",
    customerName: "ryyfd",
    phone: "09171234567",
    washType: "Regular",
    weight: 1,
    fee: 40,
    status: "Received",
    paymentStatus: "paid",
    arrivalDateTime: "2026-09-14 14:58",
    dropOffDate: "2026-09-14",
    addOns: [],
  },
];

describe("ProcessingPage Single-Click Action Buttons", () => {
  it("triggers onUpdateTransaction on a single click of Start Wash button", async () => {
    const onUpdateTransaction = vi.fn().mockResolvedValue({
      transaction: { ...mockTransactions[0], status: "Washing" },
    });

    render(
      <ProcessingPage
        transactions={mockTransactions}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    const startWashButtons = screen.getAllByRole("button", { name: /start wash/i });
    expect(startWashButtons.length).toBeGreaterThan(0);

    fireEvent.click(startWashButtons[0]);

    expect(onUpdateTransaction).toHaveBeenCalledTimes(1);
    expect(onUpdateTransaction).toHaveBeenCalledWith("TKT-0030", { status: "Washing" });
  });

  it("triggers onUpdateTransaction on a single click of mobile short action button", async () => {
    const onUpdateTransaction = vi.fn().mockResolvedValue({
      transaction: { ...mockTransactions[0], status: "Washing" },
    });

    render(
      <ProcessingPage
        transactions={mockTransactions}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    const mobileButton = screen.getByRole("button", { name: /^wash →$/i });
    expect(mobileButton).toBeInTheDocument();

    fireEvent.click(mobileButton);

    expect(onUpdateTransaction).toHaveBeenCalledTimes(1);
    expect(onUpdateTransaction).toHaveBeenCalledWith("TKT-0030", { status: "Washing" });
  });
});
