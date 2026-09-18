import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TransactionsPage from "@/components/pages/transactions";
import type { Transaction } from "@/lib/data";
import { updateTransaction } from "@/lib/server/laundry-repository";

const testTransactions: Transaction[] = [
  {
    id: "tx-claimed-1",
    ticketId: "TKT-0001",
    customerName: "Maria Santos",
    phone: "09171234567",
    arrivalDateTime: "2026-09-18 08:00",
    dropOffDate: "2026-09-18",
    claimedAt: "2026-09-18 14:34",
    washType: "Regular",
    weight: 5,
    fee: 150,
    status: "Claimed",
    paymentStatus: "paid",
    addOns: [],
  },
  {
    id: "tx-voided-1",
    ticketId: "TKT-0002",
    customerName: "Jose Reyes",
    phone: "09281234567",
    arrivalDateTime: "2026-09-18 09:00",
    dropOffDate: "2026-09-18",
    voidedAt: "2026-09-18 15:08",
    voidReason: "Customer cancelled",
    washType: "Express",
    weight: 4,
    fee: 200,
    status: "Voided",
    paymentStatus: "unpaid",
    addOns: [],
  },
  {
    id: "tx-claimed-legacy",
    ticketId: "TKT-0003",
    customerName: "Old Claimed Record",
    phone: "09351234567",
    arrivalDateTime: "2026-09-17 10:00",
    dropOffDate: "2026-09-17",
    washType: "Regular",
    weight: 3,
    fee: 100,
    status: "Claimed",
    paymentStatus: "paid",
    addOns: [],
  },
  {
    id: "tx-voided-legacy",
    ticketId: "TKT-0004",
    customerName: "Old Voided Record",
    phone: "09461234567",
    arrivalDateTime: "2026-09-17 11:00",
    dropOffDate: "2026-09-17",
    washType: "Regular",
    weight: 3,
    fee: 100,
    status: "Voided",
    paymentStatus: "unpaid",
    addOns: [],
  },
  {
    id: "tx-active-1",
    ticketId: "TKT-0005",
    customerName: "Active Order User",
    phone: "09571234567",
    arrivalDateTime: "2026-09-18 11:00",
    dropOffDate: "2026-09-18",
    washType: "Regular",
    weight: 4,
    fee: 120,
    status: "Ready",
    paymentStatus: "paid",
    addOns: [],
  },
];

describe("Transaction Lifecycle Timestamps", () => {
  describe("Repository boundary updates", () => {
    it("sets claimedAt when status transitions to Claimed", async () => {
      const updated = await updateTransaction("TKT-0001", { status: "Claimed" });
      expect(updated.status).toBe("Claimed");
      expect(updated.claimedAt).toBeDefined();
    });

    it("sets voidedAt when status transitions to Voided", async () => {
      const updated = await updateTransaction("TKT-0002", { status: "Voided", voidReason: "Customer request" });
      expect(updated.status).toBe("Voided");
      expect(updated.voidedAt).toBeDefined();
      expect(updated.voidReason).toBe("Customer request");
    });

    it("does not overwrite existing claimedAt on subsequent edits", async () => {
      const first = await updateTransaction("TKT-0001", { status: "Claimed" });
      const originalClaimedAt = first.claimedAt;

      const second = await updateTransaction("TKT-0001", { washInstructions: "Updated note after claim" });
      expect(second.claimedAt).toBe(originalClaimedAt);
    });

    it("does not overwrite existing voidedAt on subsequent edits", async () => {
      const first = await updateTransaction("TKT-0002", { status: "Voided", voidReason: "Initial reason" });
      const originalVoidedAt = first.voidedAt;

      const second = await updateTransaction("TKT-0002", { washInstructions: "Updated note after void" });
      expect(second.voidedAt).toBe(originalVoidedAt);
    });
  });

  describe("TransactionsPage UI Display", () => {
    it("renders terminal event timestamp for Claimed order with 12-hour format", () => {
      render(
        <TransactionsPage
          transactions={testTransactions}
          onCreateTransaction={vi.fn()}
          onUpdateTransaction={vi.fn()}
        />
      );

      // Switch to Claimed tab
      const claimedTab = screen.getByRole("tab", { name: /^claimed/i });
      fireEvent.click(claimedTab);

      // Should show Claimed timestamp matching "Claimed Sep 18, 2026 · 2:34 PM" (or localized format with AM/PM)
      const claimedElements = screen.getAllByText(/Claimed Sep 18, 2026 · 2:34 PM/i);
      expect(claimedElements.length).toBeGreaterThan(0);
    });

    it("renders terminal event timestamp and void reason for Voided order", () => {
      render(
        <TransactionsPage
          transactions={testTransactions}
          onCreateTransaction={vi.fn()}
          onUpdateTransaction={vi.fn()}
        />
      );

      // Switch to Voided tab
      const voidedTab = screen.getByRole("tab", { name: /^voided/i });
      fireEvent.click(voidedTab);

      // Should show Voided timestamp
      const voidedElements = screen.getAllByText(/Voided Sep 18, 2026 · 3:08 PM/i);
      expect(voidedElements.length).toBeGreaterThan(0);

      // Should show void reason
      const reasonElements = screen.getAllByText(/Reason: Customer cancelled/i);
      expect(reasonElements.length).toBeGreaterThan(0);
    });

    it("renders neutral fallback when terminal timestamp is unavailable", () => {
      render(
        <TransactionsPage
          transactions={testTransactions}
          onCreateTransaction={vi.fn()}
          onUpdateTransaction={vi.fn()}
        />
      );

      // Switch to All tab to view all orders including legacy ones
      const allTab = screen.getByRole("tab", { name: /^all/i });
      fireEvent.click(allTab);

      expect(screen.getAllByText(/Claimed time unavailable/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Voided time unavailable/i).length).toBeGreaterThan(0);
    });

    it("does not render terminal lifecycle timestamps for active orders", () => {
      render(
        <TransactionsPage
          transactions={testTransactions}
          onCreateTransaction={vi.fn()}
          onUpdateTransaction={vi.fn()}
        />
      );

      // Active order TKT-0005 is "Ready" - should not show "Ready time unavailable" or similar
      expect(screen.queryByText(/Ready Sep/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Ready time unavailable/i)).not.toBeInTheDocument();
    });
  });
});
