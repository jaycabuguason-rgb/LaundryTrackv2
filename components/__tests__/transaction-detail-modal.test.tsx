import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TransactionDetailModal } from "../transaction-detail-modal";
import { type Transaction } from "@/lib/data";

const mockTransaction: Transaction = {
  id: "tx-0027",
  dropOffDate: "2026-09-09",
  ticketId: "TKT-0027",
  customerName: "Maria Santos",
  phone: "+63 917 220 9021",
  arrivalDateTime: "2026-09-09 06:55:12",
  status: "Washing",
  paymentStatus: "unpaid",
  washType: "Regular Wash",
  weight: 1.0,
  addOns: ["Fabcon"],
  fee: 40,
  eta: "2026-09-09 07:50:00",
  washInstructions: "Handle with care",
};

describe("TransactionDetailModal - Mobile View Ticket Concept", () => {
  it("renders the mobile drawer header with ticket ID pill, print button, and close button", () => {
    const handleClose = vi.fn();
    render(
      <TransactionDetailModal
        open={true}
        onOpenChange={handleClose}
        transaction={mockTransaction}
      />
    );

    expect(screen.getByText("Ticket Details")).toBeInTheDocument();
    expect(screen.getAllByText("TKT-0027").length).toBeGreaterThan(0);
    expect(screen.getByTitle("Print Tag")).toBeInTheDocument();
    expect(screen.getByTitle("Close")).toBeInTheDocument();
  });

  it("renders the Current Stage & Quick Payment Banner with correct status and unpaid fee", () => {
    render(
      <TransactionDetailModal
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    expect(screen.getByText("Current Stage")).toBeInTheDocument();
    expect(screen.getAllByText("Washing").length).toBeGreaterThan(0);
    expect(screen.getByText(/Machine Processing/i)).toBeInTheDocument();
    expect(screen.getByText("Unpaid • ₱40")).toBeInTheDocument();
  });

  it("renders the 4-step status progress timeline with step subtext", () => {
    render(
      <TransactionDetailModal
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    expect(screen.getByText("Status Progress")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText("In drum")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Claimed")).toBeInTheDocument();
  });

  it("renders the 2-column Order Breakdown grid with customer info, weight, add-ons, and total bill", () => {
    render(
      <TransactionDetailModal
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    expect(screen.getByText("Order Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("+63 917 220 9021")).toBeInTheDocument();
    expect(screen.getByText("Regular Wash")).toBeInTheDocument();
    expect(screen.getByText("Fabcon")).toBeInTheDocument();
    expect(screen.getByText("₱40")).toBeInTheDocument();
    expect(screen.getByText("Collect at Pickup")).toBeInTheDocument();
  });

  it("renders Pickup Verification QR code card and shop counter badge", () => {
    render(
      <TransactionDetailModal
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    expect(screen.getByText("Pickup Verification")).toBeInTheDocument();
    expect(screen.getByAltText("QR Verification for TKT-0027")).toBeInTheDocument();
    expect(screen.getByText(/Scan QR code at counter terminal/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Counter Terminal/i).length).toBeGreaterThan(0);
  });

  it("triggers stage advancement, quick payment settlement, and bottom collapse", () => {
    const handleAdvance = vi.fn();
    const handlePay = vi.fn();
    const handleClose = vi.fn();

    render(
      <TransactionDetailModal
        open={true}
        onOpenChange={handleClose}
        transaction={mockTransaction}
        onAdvanceStage={handleAdvance}
        onReceivePayment={handlePay}
      />
    );

    const advanceBtn = screen.getByText(/Advance to Ready/i);
    fireEvent.click(advanceBtn);
    expect(handleAdvance).toHaveBeenCalledWith(mockTransaction);

    const payBtn = screen.getByText(/Receive ₱40/i);
    fireEvent.click(payBtn);
    expect(handlePay).toHaveBeenCalledWith(mockTransaction);

    const collapseBtn = screen.getByText(/Swipe down or tap to collapse/i);
    fireEvent.click(collapseBtn);
    expect(handleClose).toHaveBeenCalledWith(false);
  });
});
