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

  it("renders mobile pipeline header, segmented tabs, and mobile card info", () => {
    render(<ProcessingPage transactions={mockTransactions} />);

    // Mobile header
    expect(screen.getByRole("heading", { level: 1, name: /processing pipeline/i })).toBeInTheDocument();
    expect(screen.getByText(/total ongoing transactions:/i)).toBeInTheDocument();

    // Mobile segmented tabs
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(3);
    expect(tabs[0]).toHaveTextContent(/received/i);
    expect(tabs[1]).toHaveTextContent(/washing/i);
    expect(tabs[2]).toHaveTextContent(/ready/i);

    // Mobile card fields
    expect(screen.getByText("#TKT-0030")).toBeInTheDocument();
    expect(screen.getAllByText("ryyfd").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1 kg").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("₱40").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/select all in stage/i).length).toBeGreaterThanOrEqual(1);

    // Tab click switches stage
    fireEvent.click(tabs[1]); // Click Washing tab
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("prevents duplicate concurrent status clicks on the same ticket while saving", async () => {
    let resolvePromise: (value: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    const onUpdateTransaction = vi.fn().mockReturnValue(pendingPromise);

    render(
      <ProcessingPage
        transactions={mockTransactions}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    const startWashButtons = screen.getAllByRole("button", { name: /start wash/i });
    expect(startWashButtons.length).toBeGreaterThan(0);

    // First click initiates mutation
    fireEvent.click(startWashButtons[0]);
    expect(onUpdateTransaction).toHaveBeenCalledTimes(1);

    // Button should now show Saving… and be disabled
    expect(screen.getAllByText(/saving…/i).length).toBeGreaterThanOrEqual(1);

    // Second click on the same ticket while in-flight should not fire again
    fireEvent.click(startWashButtons[0]);
    expect(onUpdateTransaction).toHaveBeenCalledTimes(1);

    // Resolve update
    resolvePromise({ transaction: { ...mockTransactions[0], status: "Washing" } });
  });

  it("removes a claimed ticket immediately from the Processing pipeline", () => {
    const readyTx: Transaction = {
      id: "tx-ready-1",
      ticketId: "TKT-0099",
      customerName: "Juan Dela Cruz",
      phone: "09171234567",
      washType: "Regular",
      weight: 3,
      fee: 120,
      status: "Ready",
      paymentStatus: "paid",
      arrivalDateTime: "2026-09-14 14:00",
      dropOffDate: "2026-09-14",
      addOns: [],
    };

    const { rerender } = render(
      <ProcessingPage transactions={[readyTx]} />
    );

    // Total ongoing shows 1
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);

    // Switch to Ready tab to view the Ready ticket
    const readyTab = screen.getByRole("tab", { name: /ready/i });
    fireEvent.click(readyTab);

    // Verify Ready ticket is visible
    expect(screen.getAllByText("Juan Dela Cruz").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TKT-0099/).length).toBeGreaterThan(0);

    // After claim in Claim Verification, transactions updates to Claimed
    rerender(
      <ProcessingPage transactions={[{ ...readyTx, status: "Claimed" }]} />
    );

    // Total ongoing drops to 0 and ticket disappears from Processing immediately
    expect(screen.queryByText("Juan Dela Cruz")).not.toBeInTheDocument();
    expect(screen.queryByText(/TKT-0099/)).not.toBeInTheDocument();
  });

  it("renders floating bulk action bar above mobile bottom nav when tickets are selected", () => {
    render(<ProcessingPage transactions={mockTransactions} />);

    // Initially, bulk action bar is not rendered
    expect(screen.queryByTestId("bulk-action-bar")).not.toBeInTheDocument();

    // Select ticket
    const selectCheckboxes = screen.getAllByLabelText(/select ticket/i);
    expect(selectCheckboxes.length).toBeGreaterThan(0);
    fireEvent.click(selectCheckboxes[0]);

    // Bulk action bar appears
    const bar = screen.getByTestId("bulk-action-bar");
    expect(bar).toBeInTheDocument();
    expect(screen.getByText(/ticket selected/i)).toBeInTheDocument();

    // Verify positioning classes for mobile (floating above bottom nav) and desktop
    expect(bar.className).toContain("bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]");
    expect(bar.className).toContain("lg:bottom-6");
    expect(bar.className).toContain("z-50");

    // Clear selection
    const clearButton = screen.getByRole("button", { name: /clear selection/i });
    fireEvent.click(clearButton);

    // Bulk action bar is dismissed
    expect(screen.queryByTestId("bulk-action-bar")).not.toBeInTheDocument();
  });
});


