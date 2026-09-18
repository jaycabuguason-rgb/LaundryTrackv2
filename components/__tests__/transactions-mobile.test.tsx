import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import TransactionsPage from "@/components/pages/transactions";
import type { Transaction } from "@/lib/data";

const mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    ticketId: "TKT-0027",
    customerName: "Alice Santos",
    phone: "09171234567",
    washType: "Regular",
    weight: 4.5,
    fee: 180,
    status: "Washing",
    paymentStatus: "unpaid",
    arrivalDateTime: "2026-09-09 10:00",
    dropOffDate: "2026-09-09",
    addOns: ["Fabcon"],
    machineNumber: 3,
  },
  {
    id: "tx-2",
    ticketId: "TKT-0028",
    customerName: "Bob Reyes",
    phone: "09189876543",
    washType: "Comforter",
    weight: 8.0,
    fee: 350,
    status: "Ready",
    paymentStatus: "paid",
    arrivalDateTime: "2026-09-09 11:30",
    dropOffDate: "2026-09-09",
    addOns: [],
  },
  {
    id: "tx-3",
    ticketId: "TKT-0029",
    customerName: "Charlie Cruz",
    phone: "09191112222",
    washType: "Wash & Fold",
    weight: 5.0,
    fee: 220,
    status: "Claimed",
    paymentStatus: "paid",
    arrivalDateTime: "2026-09-08 09:00",
    dropOffDate: "2026-09-08",
  },
  {
    id: "tx-4",
    ticketId: "TKT-0030",
    customerName: "David Lee",
    phone: "09203334444",
    washType: "Regular",
    weight: 3.0,
    fee: 150,
    status: "Voided",
    paymentStatus: "unpaid",
    arrivalDateTime: "2026-09-07 14:00",
    dropOffDate: "2026-09-07",
    voidReason: "Customer cancelled",
  },
];

describe("TransactionsPage Mobile Concept Layout", () => {
  const onUpdateTransaction = vi.fn().mockResolvedValue({
    transaction: mockTransactions[0],
  });
  const onCreateTransaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mobile header, live metrics strip, and new order button", () => {
    render(
      <TransactionsPage
        transactions={mockTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    // Title & subtitle
    expect(screen.getAllByText("Transactions").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Monitor laundry orders, stage progress & payments/i)
    ).toBeInTheDocument();

    // Mobile Live Aggregated Metrics Strip (Active orders default = 2 txns: tx-1 & tx-2, fee = 180 + 350 = 530, weight = 12.5 kg)
    expect(screen.getAllByText("orders").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("₱530").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("12.5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("kg").length).toBeGreaterThanOrEqual(1);

    // Scan button (Claim Verification) and New Order button
    expect(
      screen.getByRole("button", { name: /claim verification/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new order/i })).toBeInTheDocument();
  });

  it("redirects to claim verification when QR button is clicked", () => {
    const onNavigate = vi.fn();
    render(
      <TransactionsPage
        transactions={mockTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
        onNavigate={onNavigate}
      />
    );

    const qrBtn = screen.getByRole("button", { name: /claim verification/i });
    fireEvent.click(qrBtn);
    expect(onNavigate).toHaveBeenCalledWith("claim-verification");
  });

  it("switches mobile segmented tabs between Active, Claimed, All, and Voided", () => {
    render(
      <TransactionsPage
        transactions={mockTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    // Initially in Active tab (2 active orders: Alice and Bob)
    expect(screen.getByLabelText(/Ticket #TKT-0027/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ticket #TKT-0028/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Ticket #TKT-0029/i)).not.toBeInTheDocument(); // Claimed

    // Click Claimed tab
    const claimedTab = screen.getByRole("tab", { name: /^claimed/i });
    fireEvent.click(claimedTab);
    expect(screen.getByLabelText(/Ticket #TKT-0029/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Ticket #TKT-0027/i)).not.toBeInTheDocument();

    // Click Voided tab
    const voidedTab = screen.getByRole("tab", { name: /^voided/i });
    fireEvent.click(voidedTab);
    expect(screen.getByLabelText(/Ticket #TKT-0030/i)).toBeInTheDocument();

    // Click All tab
    const allTab = screen.getByRole("tab", { name: /^all/i });
    fireEvent.click(allTab);
    expect(screen.getByLabelText(/Ticket #TKT-0027/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ticket #TKT-0028/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ticket #TKT-0029/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ticket #TKT-0030/i)).toBeInTheDocument();
  });

  it("filters transactions via search input and clears search", () => {
    render(
      <TransactionsPage
        transactions={mockTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    const searchInputs = screen.getAllByPlaceholderText(
      /search.*customer name.*ticket ID/i
    );
    const mobileSearchInput = searchInputs[0];

    // Search for Alice
    fireEvent.change(mobileSearchInput, { target: { value: "Alice" } });
    expect(screen.getByLabelText(/Ticket #TKT-0027/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Ticket #TKT-0028/i)).not.toBeInTheDocument();

    // Clear search button
    const clearButton = screen.getAllByRole("button", { name: /clear search/i })[0];
    fireEvent.click(clearButton);
    expect(screen.getByLabelText(/Ticket #TKT-0028/i)).toBeInTheDocument();

    // Search by phone number (0918 for Bob Reyes)
    fireEvent.change(mobileSearchInput, { target: { value: "0918" } });
    expect(screen.getByLabelText(/Ticket #TKT-0028/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Ticket #TKT-0027/i)).not.toBeInTheDocument();
  });

  it("defaults to Newest First sorting", () => {
    render(
      <TransactionsPage
        transactions={mockTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    // In desktop view or mobile cards, Newest First should place TKT-0028 (11:30) before TKT-0027 (10:00)
    const cards = screen.getAllByLabelText(/Ticket #TKT-/i);
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards[0]).toHaveAttribute("aria-label", expect.stringContaining("TKT-0028"));
    expect(cards[1]).toHaveAttribute("aria-label", expect.stringContaining("TKT-0027"));
  });

  it("opens mobile quick action drawer when clicking more options button on a card", () => {
    render(
      <TransactionsPage
        transactions={mockTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    // Find more options button on the mobile card for TKT-0027
    const card27 = screen.getByLabelText(/Ticket #TKT-0027/i);
    const moreBtn = within(card27).getByRole("button", { name: /more options/i });
    fireEvent.click(moreBtn);

    // Drawer should open and display actions
    expect(screen.getByText("Transaction Quick Menu")).toBeInTheDocument();
    expect(screen.getByText("Slips & QR Outputs")).toBeInTheDocument();
    expect(screen.getByText("POS Thermal")).toBeInTheDocument();
    expect(screen.getByText("Print Receipt")).toBeInTheDocument();
    expect(screen.getByText("Download Receipt")).toBeInTheDocument();
    expect(screen.getByText("QR Code Ticket")).toBeInTheDocument();
    expect(screen.getByText("Print QR Bag Tag Only")).toBeInTheDocument();
    expect(screen.getByText("Download QR Code")).toBeInTheDocument();
    expect(screen.getByText("Workflow & Ledger")).toBeInTheDocument();
    expect(screen.getByText(/Settle Payment/i)).toBeInTheDocument();
    expect(screen.getByText("Edit Order")).toBeInTheDocument();
    expect(screen.getByText("Change Status")).toBeInTheDocument();
    expect(screen.getByText("Void Order")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dismiss menu/i })).toBeInTheDocument();
  });

  it("handles quick payment settlement from the mobile drawer", async () => {
    render(
      <TransactionsPage
        transactions={mockTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    const card27 = screen.getByLabelText(/Ticket #TKT-0027/i);
    const moreBtn = within(card27).getByRole("button", { name: /more options/i });
    fireEvent.click(moreBtn);

    const settleBtn = screen.getByText(/Settle Payment/i);
    fireEvent.click(settleBtn);

    await waitFor(() => {
      expect(onUpdateTransaction).toHaveBeenCalledWith("TKT-0027", {
        status: "Washing",
        paymentStatus: "paid",
      });
    });
  });

  it("handles quick claim action for ready orders", async () => {
    render(
      <TransactionsPage
        transactions={mockTransactions}
        onCreateTransaction={onCreateTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    // Bob Reyes is Ready and paid, so he has a Claim button
    const claimButton = screen.getByRole("button", { name: /^claim$/i });
    expect(claimButton).toBeInTheDocument();

    fireEvent.click(claimButton);

    await waitFor(() => {
      expect(onUpdateTransaction).toHaveBeenCalledWith("TKT-0028", {
        status: "Claimed",
        paymentStatus: "paid",
      });
    });
  });
});
