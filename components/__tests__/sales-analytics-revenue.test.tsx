import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReportsPage from "@/components/pages/reports";
import { updateTransaction, createTransaction } from "@/lib/server/laundry-repository";
import type { Transaction } from "@/lib/data";
import { format } from "date-fns";

// Mock recharts responsive container for jsdom
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 500, height: 300 }}>
        {children}
      </div>
    ),
  };
});

describe("Payment-Recognized Sales Analytics & Lifecycle", () => {
  describe("Repository & Timestamp Attribution", () => {
    it("assigns paidAt timestamp when an unpaid order is marked paid", async () => {
      const created = await createTransaction({
        customerName: "Juan Luna",
        phone: "09170001111",
        arrivalDateTime: "2026-04-05 08:00",
        washType: "Regular",
        weight: 5,
        fee: 200,
        status: "Received",
        paymentStatus: "unpaid",
        addOns: [],
      });

      expect(created.paymentStatus).toBe("unpaid");
      expect(created.paidAt).toBeUndefined();

      const updated = await updateTransaction(created.ticketId, {
        paymentStatus: "paid",
      });

      expect(updated.paymentStatus).toBe("paid");
      expect(updated.paidAt).toBeDefined();

      const firstPaidAt = updated.paidAt;

      // Re-saving should preserve original paidAt
      const resaved = await updateTransaction(created.ticketId, {
        washInstructions: "Handle with extra care",
      });

      expect(resaved.paidAt).toBe(firstPaidAt);
    });

    it("rejects transition to Claimed when transaction is unpaid", async () => {
      const created = await createTransaction({
        customerName: "Maria Clara",
        phone: "09170002222",
        arrivalDateTime: "2026-04-05 09:00",
        washType: "Regular",
        weight: 4,
        fee: 160,
        status: "Ready",
        paymentStatus: "unpaid",
        addOns: [],
      });

      await expect(
        updateTransaction(created.ticketId, {
          status: "Claimed",
        }),
      ).rejects.toThrow(/Cannot mark transaction as Claimed while payment is unpaid/i);
    });

    it("allows atomic paid-and-claim transition and sets both timestamps", async () => {
      const created = await createTransaction({
        customerName: "Crisostomo Ibarra",
        phone: "09170003333",
        arrivalDateTime: "2026-04-05 09:30",
        washType: "Express",
        weight: 6,
        fee: 300,
        status: "Ready",
        paymentStatus: "unpaid",
        addOns: [],
      });

      const claimed = await updateTransaction(created.ticketId, {
        status: "Claimed",
        paymentStatus: "paid",
      });

      expect(claimed.status).toBe("Claimed");
      expect(claimed.paymentStatus).toBe("paid");
      expect(claimed.claimedAt).toBeDefined();
      expect(claimed.paidAt).toBeDefined();
    });
  });

  describe("Reports Page Revenue Recognition", () => {
    const testDate = format(new Date(), "yyyy-MM-dd");

    const testTransactions: Transaction[] = [
      {
        id: "test-1",
        ticketId: "TKT-T1",
        customerName: "Paid Customer",
        phone: "09171111111",
        washType: "Regular",
        weight: 5,
        fee: 500,
        status: "Ready",
        paymentStatus: "paid",
        arrivalDateTime: `${testDate} 09:00`,
        dropOffDate: testDate,
        paidAt: `${testDate} 09:00`,
        addOns: [],
      },
      {
        id: "test-2",
        ticketId: "TKT-T2",
        customerName: "Unpaid Customer",
        phone: "09172222222",
        washType: "Express",
        weight: 3,
        fee: 300,
        status: "Washing",
        paymentStatus: "unpaid",
        arrivalDateTime: `${testDate} 10:00`,
        dropOffDate: testDate,
        addOns: [],
      },
      {
        id: "test-3",
        ticketId: "TKT-T3",
        customerName: "Voided Customer",
        phone: "09173333333",
        washType: "Delicate",
        weight: 2,
        fee: 200,
        status: "Voided",
        paymentStatus: "paid",
        arrivalDateTime: `${testDate} 11:00`,
        dropOffDate: testDate,
        paidAt: `${testDate} 11:00`,
        voidedAt: `${testDate} 11:30`,
        addOns: [],
      },
    ];

    it("counts paid order in Collected Revenue and unpaid in Outstanding", () => {
      render(<ReportsPage transactions={testTransactions} />);

      const tabs = screen.getAllByRole("tab");
      const analyticsTab = tabs.find((tab) => tab.textContent?.includes("Sales Analytics"));
      expect(analyticsTab).toBeDefined();
      if (analyticsTab) {
        fireEvent.click(analyticsTab);
      }

      // Check Collected Revenue cards
      expect(screen.getAllByText("Collected Revenue").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Outstanding").length).toBeGreaterThanOrEqual(1);

      // 500 should be collected (test-1), 300 outstanding (test-2), 200 excluded (test-3 voided)
      expect(screen.getAllByText("₱500").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("₱300").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("₱1,000")).not.toBeInTheDocument(); // Gross sum should not be used as collected
    });
  });
});
