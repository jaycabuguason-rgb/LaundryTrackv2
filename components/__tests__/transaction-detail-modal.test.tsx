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

  it("renders thermal receipt and edit details while omitting advance, payment, and bottom collapse buttons", () => {
    const handleEdit = vi.fn();
    const handleClose = vi.fn();
    const handleReprint = vi.fn();

    render(
      <TransactionDetailModal
        open={true}
        onOpenChange={handleClose}
        transaction={mockTransaction}
        onEditStatus={handleEdit}
        onReprintQr={handleReprint}
      />
    );

    // Assert that the removed elements are not in the document
    expect(screen.queryByText(/Advance to/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark as Claimed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Receive ₱/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Payment Received/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Swipe down or tap to collapse/i)).not.toBeInTheDocument();

    // Assert that Thermal Receipt is rendered and clickable
    const receiptBtn = screen.getByText("Thermal Receipt");
    expect(receiptBtn).toBeInTheDocument();
    fireEvent.click(receiptBtn);
    expect(handleReprint).toHaveBeenCalledWith(mockTransaction);

    // Assert that Edit Full Order Details is rendered and clickable
    const editBtn = screen.getByText("Edit Full Order Details");
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);
    expect(handleClose).toHaveBeenCalledWith(false);
    expect(handleEdit).toHaveBeenCalledWith(mockTransaction.ticketId);
  });

  it("does NOT render QR code for Claimed ticket and displays claim date & time", () => {
    const claimedTxn: Transaction = {
      ...mockTransaction,
      status: "Claimed",
      paymentStatus: "paid",
      claimedAt: "2026-09-18 14:34",
    };

    render(
      <TransactionDetailModal
        open={true}
        onOpenChange={vi.fn()}
        transaction={claimedTxn}
      />
    );

    // QR code is hidden
    expect(screen.queryByText("Pickup Verification")).not.toBeInTheDocument();
    expect(screen.queryByAltText("QR Verification for TKT-0027")).not.toBeInTheDocument();

    // Claimed info is displayed
    expect(screen.getByText("Order Claimed & Completed")).toBeInTheDocument();
    expect(screen.getByText(/Sep 18, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Handed Over to Customer/i)).toBeInTheDocument();
  });

  it("does NOT render QR code for Voided ticket and displays void date, time & reason", () => {
    const voidedTxn: Transaction = {
      ...mockTransaction,
      status: "Voided",
      voidedAt: "2026-09-18 15:08",
      voidReason: "Customer requested cancellation",
    };

    render(
      <TransactionDetailModal
        open={true}
        onOpenChange={vi.fn()}
        transaction={voidedTxn}
      />
    );

    // QR code is hidden
    expect(screen.queryByText("Pickup Verification")).not.toBeInTheDocument();
    expect(screen.queryByAltText("QR Verification for TKT-0027")).not.toBeInTheDocument();

    // Voided info is displayed
    expect(screen.getByText("Transaction Cancelled & Voided")).toBeInTheDocument();
    expect(screen.getAllByText(/Customer requested cancellation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sep 18, 2026/i).length).toBeGreaterThan(0);
  });
});
