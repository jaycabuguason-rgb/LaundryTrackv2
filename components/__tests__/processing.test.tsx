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

  it("does not display Claim Order button for Ready tickets since claiming is handled via Claim Verification", () => {
    const readyTransactions: Transaction[] = [
      {
        id: "tx-ready",
        ticketId: "TKT-0028",
        customerName: "fdsdg",
        phone: "09171234567",
        washType: "Regular",
        weight: 14,
        fee: 430,
        status: "Ready",
        paymentStatus: "paid",
        arrivalDateTime: "2026-09-09 09:07",
        dropOffDate: "2026-09-09",
        addOns: [],
      },
    ];

    render(
      <ProcessingPage
        transactions={readyTransactions}
        onUpdateTransaction={vi.fn()}
      />
    );

    // Expand Ready stage card
    const readyToggle = screen.getByRole("button", { name: /ready/i });
    fireEvent.click(readyToggle);

    // Ensure no "Claim Order" or "Claim" buttons exist
    expect(screen.queryByRole("button", { name: /claim order/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^claim$/i })).not.toBeInTheDocument();
  });
});
