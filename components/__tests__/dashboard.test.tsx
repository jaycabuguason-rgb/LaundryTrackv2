import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardPage from "@/components/pages/dashboard";
import { type Transaction } from "@/lib/data";

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
    arrivalDateTime: "2026-03-01 10:00 AM",
    dropOffDate: "2026-03-01",
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
    status: "Ready",
    paymentStatus: "unpaid",
    arrivalDateTime: "2026-03-01 11:00 AM",
    dropOffDate: "2026-03-01",
    addOns: [],
  },
];

describe("Dashboard Accessibility & Responsiveness", () => {
  it("renders correct semantic heading hierarchy (h1 and h2)", () => {
    render(<DashboardPage transactions={mockTransactions} />);

    const mainHeading = screen.getByRole("heading", { level: 1, name: /dashboard/i });
    expect(mainHeading).toBeInTheDocument();

    const recentOrdersHeading = screen.getByRole("heading", { level: 2, name: /recent orders/i });
    expect(recentOrdersHeading).toBeInTheDocument();

    const ordersByStageHeading = screen.getByRole("heading", { level: 2, name: /orders by stage/i });
    expect(ordersByStageHeading).toBeInTheDocument();
  });

  it("renders stat cards as informational non-clickable cards", () => {
    const onNavigate = vi.fn();
    render(<DashboardPage transactions={mockTransactions} onNavigate={onNavigate} />);

    expect(screen.getByText("Today's Orders")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Ready for Pickup")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();

    const statButtons = screen.getAllByRole("button");
    const todayOrdersCard = statButtons.find((btn) =>
      btn.getAttribute("aria-label")?.includes("Today's Orders")
    );
    expect(todayOrdersCard).toBeUndefined();
  });

  it("renders Donut chart SVG with role=img and descriptive aria-label", () => {
    render(<DashboardPage transactions={mockTransactions} />);
    const chart = screen.getByRole("img", { name: /order distribution:/i });
    expect(chart).toBeInTheDocument();
  });

  it("includes scope=col on all table header cells", () => {
    const { container } = render(<DashboardPage transactions={mockTransactions} />);
    const ths = container.querySelectorAll("th");
    expect(ths.length).toBe(5);
    ths.forEach((th) => {
      expect(th.getAttribute("scope")).toBe("col");
    });
  });

  it("renders table rows as accessible interactive elements with tabIndex and keydown triggers", () => {
    render(<DashboardPage transactions={mockTransactions} />);
    const orderRow = screen.getByLabelText(/view order #1001 for alice santos/i);
    expect(orderRow).toHaveAttribute("role", "button");
    expect(orderRow).toHaveAttribute("tabIndex", "0");

    // Pressing Enter opens modal
    fireEvent.keyDown(orderRow, { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("includes tabular-nums class on numerical and currency metrics", () => {
    const { container } = render(<DashboardPage transactions={mockTransactions} />);
    const tabularElements = container.querySelectorAll(".tabular-nums");
    expect(tabularElements.length).toBeGreaterThanOrEqual(5);
  });

  it("renders mobile view components including quick actions and mobile order cards", () => {
    const onNavigate = vi.fn();
    render(<DashboardPage transactions={mockTransactions} onNavigate={onNavigate} />);

    // Mobile header indicators
    expect(screen.getByText("Today at a glance")).toBeInTheDocument();
    expect(screen.getByText("Live Sync")).toBeInTheDocument();
    expect(screen.getByText(/operational metrics/i)).toBeInTheDocument();

    // Mobile quick action buttons
    const scanBtn = screen.getByRole("button", { name: /scan qr/i });
    const intakeBtn = screen.getByRole("button", { name: /intake order/i });
    expect(scanBtn).toBeInTheDocument();
    expect(intakeBtn).toBeInTheDocument();

    fireEvent.click(scanBtn);
    expect(onNavigate).toHaveBeenCalledWith("claim-verification");

    fireEvent.click(intakeBtn);
    expect(onNavigate).toHaveBeenCalledWith("new-transaction");

    // Mobile order card accessibility and interaction
    const mobileCard = screen.getByLabelText(/order #1001 details for alice santos/i);
    expect(mobileCard).toHaveAttribute("role", "button");
    expect(mobileCard).toHaveAttribute("tabIndex", "0");

    fireEvent.click(mobileCard);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

