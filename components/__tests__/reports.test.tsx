import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReportsPage from "@/components/pages/reports";
import { type Transaction } from "@/lib/data";
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

const todayKey = format(new Date(), "yyyy-MM-dd");

const mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    ticketId: "1001",
    customerName: "Alice Santos",
    phone: "09171234567",
    washType: "Regular",
    weight: 5,
    fee: 250,
    status: "Received",
    paymentStatus: "paid",
    arrivalDateTime: "10:00 AM",
    dropOffDate: todayKey,
    addOns: [],
  },
  {
    id: "tx-2",
    ticketId: "1002",
    customerName: "Bob Reyes",
    phone: "09181234567",
    washType: "Delicate",
    weight: 3,
    fee: 150,
    status: "Washing",
    paymentStatus: "unpaid",
    arrivalDateTime: "11:00 AM",
    dropOffDate: todayKey,
    addOns: [],
  },
  {
    id: "tx-3",
    ticketId: "1003",
    customerName: "Charlie Cruz",
    phone: "09191234567",
    washType: "Heavy Duty",
    weight: 8,
    fee: 400,
    status: "Ready",
    paymentStatus: "paid",
    arrivalDateTime: "02:00 PM",
    dropOffDate: todayKey,
    addOns: [],
  },
];

describe("ReportsPage Responsiveness and Mobile Concept Layout", () => {
  it("renders report headings and total transactions indicators", () => {
    render(<ReportsPage transactions={mockTransactions} />);

    // Check desktop and mobile headings
    const headings = screen.getAllByText("Reports");
    expect(headings.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("3 total transactions")).toBeInTheDocument();
    expect(screen.queryByText("3 total")).not.toBeInTheDocument();
  });

  it("renders mobile 2x2 metric cards and operational capacity visualizer", () => {
    render(<ReportsPage transactions={mockTransactions} />);

    // 2x2 cards: Transactions, Total Revenue, Total Weight, Ready Pickup
    expect(screen.getAllByText("Transactions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Total Revenue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Total Weight").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ready Pickup").length).toBeGreaterThanOrEqual(1);

    // Operational capacity visualizer
    expect(screen.getByText("Daily Capacity & Wash Cycles")).toBeInTheDocument();
    expect(screen.getAllByText(/Ready \(1\)/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Wash \(1\)/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Received \(1\)/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders mobile tab pill navigation and switches tabs", () => {
    render(<ReportsPage transactions={mockTransactions} />);

    // Mobile pills role="tab"
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(5);

    // Click Sales Analytics tab
    const analyticsTab = tabs.find((tab) => tab.textContent?.includes("Sales Analytics"));
    expect(analyticsTab).toBeDefined();
    if (analyticsTab) {
      fireEvent.click(analyticsTab);
      expect(screen.getAllByText("Sales Analytics").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Sales Trend").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Market (and|&) Sales Mix/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Orders in Range").length).toBeGreaterThanOrEqual(1);
    }

    // Click Customer Forecast tab
    const forecastTab = tabs.find((tab) => tab.textContent?.includes("Forecast"));
    expect(forecastTab).toBeDefined();
    if (forecastTab) {
      fireEvent.click(forecastTab);
      expect(screen.getAllByText("Customer Forecast").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Best Day to Staff Up").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Peak Drop-off Time").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Staffing Recommendation").length).toBeGreaterThanOrEqual(1);
    }

    // Click Unclaimed tab
    const unclaimedTab = tabs.find((tab) => tab.textContent?.includes("Unclaimed"));
    expect(unclaimedTab).toBeDefined();
    if (unclaimedTab) {
      fireEvent.click(unclaimedTab);
      expect(screen.getByText(/Ready but Unclaimed Items/)).toBeInTheDocument();
      expect(screen.getAllByText("Charlie Cruz").length).toBeGreaterThanOrEqual(1);
    }
  });

  it("filters mobile daily transactions by status chip", () => {
    render(<ReportsPage transactions={mockTransactions} />);

    // In overview tab, Alice Santos should initially be present
    expect(screen.getAllByText("Alice Santos").length).toBeGreaterThanOrEqual(1);

    // Click Ready filter chip
    const readyChip = screen.getByRole("button", { name: /^Ready/i });
    fireEvent.click(readyChip);

    // When filtered by Ready, Charlie Cruz should be in mobile logs
    expect(screen.getAllByText("Charlie Cruz").length).toBeGreaterThanOrEqual(1);

    // Click Received filter chip
    const receivedChip = screen.getByRole("button", { name: /^Received/i });
    fireEvent.click(receivedChip);

    expect(screen.getAllByText("Alice Santos").length).toBeGreaterThanOrEqual(1);
  });

  it("handles empty transactions gracefully", () => {
    render(<ReportsPage transactions={[]} />);

    expect(screen.getByText(/No report data yet/i)).toBeInTheDocument();
    expect(screen.getByText("0 total transactions")).toBeInTheDocument();
    expect(screen.queryByText("0 total")).not.toBeInTheDocument();
  });
});
