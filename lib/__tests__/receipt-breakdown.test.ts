import { describe, it, expect, beforeEach } from "vitest";
import { getReceiptCostBreakdown } from "@/lib/receipt-breakdown";
import type { Transaction } from "@/lib/data";

describe("getReceiptCostBreakdown", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("calculates breakdown for weighted transaction with add-ons", () => {
    const tx: Transaction = {
      id: "1",
      ticketId: "T1001",
      customerName: "Maria Santos",
      phone: "09171234567",
      washType: "Wash & Fold",
      weight: 5,
      addOns: ["Fabcon", "Bleach"],
      fee: 200,
      paymentStatus: "paid",
      status: "Washing",
      arrivalDateTime: "2026-04-05 10:00",
      dropOffDate: "2026-04-05",
      eta: "2026-04-05 15:00",
    };

    const breakdown = getReceiptCostBreakdown(tx);

    expect(breakdown.serviceName).toBe("Wash & Fold");
    expect(breakdown.addOns).toHaveLength(2);
    expect(breakdown.addOns[0].name).toBe("Fabcon");
    expect(breakdown.addOns[0].rate).toBe(10);
    expect(breakdown.addOns[1].name).toBe("Bleach");
    expect(breakdown.addOns[1].rate).toBe(15);
    expect(breakdown.addOnsTotal).toBe(25);

    expect(breakdown.serviceAmount).toBe(175);
    expect(breakdown.total).toBe(200);
    expect(breakdown.serviceDetail).toContain("5 kg");
    expect(breakdown.serviceDetail).toContain("35.00/kg");
  });

  it("handles transaction with zero weight (per load)", () => {
    const tx: Transaction = {
      id: "2",
      ticketId: "T1002",
      customerName: "John Doe",
      phone: "09181234567",
      washType: "Comforter Heavy",
      weight: 0,
      addOns: [],
      fee: 150,
      paymentStatus: "unpaid",
      status: "Received",
      arrivalDateTime: "2026-04-05 11:00",
      dropOffDate: "2026-04-05",
    };

    const breakdown = getReceiptCostBreakdown(tx);

    expect(breakdown.serviceName).toBe("Comforter Heavy");
    expect(breakdown.serviceDetail).toBe("Per Load");
    expect(breakdown.serviceAmount).toBe(150);
    expect(breakdown.addOns).toHaveLength(0);
    expect(breakdown.addOnsTotal).toBe(0);
    expect(breakdown.total).toBe(150);
  });

  it("handles transaction without add-ons", () => {
    const tx: Transaction = {
      id: "3",
      ticketId: "T1003",
      customerName: "Ana Reyes",
      phone: "09191234567",
      washType: "Wash & Iron",
      weight: 4,
      addOns: [],
      fee: 140,
      paymentStatus: "paid",
      status: "Ready",
      arrivalDateTime: "2026-04-05 12:00",
      dropOffDate: "2026-04-05",
    };

    const breakdown = getReceiptCostBreakdown(tx);

    expect(breakdown.serviceName).toBe("Wash & Iron");
    expect(breakdown.serviceAmount).toBe(140);
    expect(breakdown.serviceDetail).toContain("4 kg");
    expect(breakdown.serviceDetail).toContain("35.00/kg");
    expect(breakdown.addOns).toEqual([]);
    expect(breakdown.addOnsTotal).toBe(0);
    expect(breakdown.total).toBe(140);
  });

  it("handles transaction with unknown add-on safely", () => {
    const tx: Transaction = {
      id: "4",
      ticketId: "T1004",
      customerName: "Pedro Penduko",
      phone: "09201234567",
      washType: "Special Wash",
      weight: 3,
      addOns: ["Custom Nonexistent Addon"],
      fee: 100,
      paymentStatus: "paid",
      status: "Received",
      arrivalDateTime: "2026-04-05 13:00",
      dropOffDate: "2026-04-05",
    };

    const breakdown = getReceiptCostBreakdown(tx);

    expect(breakdown.addOns).toEqual([
      { name: "Custom Nonexistent Addon", rate: 0 },
    ]);
    expect(breakdown.addOnsTotal).toBe(0);
    expect(breakdown.serviceAmount).toBe(100);
  });
});
