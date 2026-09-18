import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClaimVerificationPage from "@/components/pages/claim-verification";
import { type Transaction } from "@/lib/data";

const mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    ticketId: "TKT-0030",
    customerName: "Juan Dela Cruz",
    phone: "09171234567",
    washType: "Regular",
    weight: 4,
    fee: 160,
    status: "Ready",
    paymentStatus: "paid",
    arrivalDateTime: "2026-09-14 14:58",
    dropOffDate: "2026-09-14",
    addOns: [],
  },
  {
    id: "tx-2",
    ticketId: "TKT-0031",
    customerName: "Jane Doe",
    phone: "09181234567",
    washType: "Delicate",
    weight: 2,
    fee: 90,
    status: "Washing",
    paymentStatus: "unpaid",
    arrivalDateTime: "2026-09-14 15:30",
    dropOffDate: "2026-09-14",
    addOns: [],
  },
  {
    id: "tx-3",
    ticketId: "TKT-0032",
    customerName: "Alice Smith",
    phone: "09191234567",
    washType: "Regular",
    weight: 3,
    fee: 120,
    status: "Received",
    paymentStatus: "paid",
    arrivalDateTime: "2026-09-14 16:00",
    dropOffDate: "2026-09-14",
    addOns: [],
  },
  {
    id: "tx-4",
    ticketId: "TKT-0033",
    customerName: "Jenny Santos",
    phone: "09201234567",
    washType: "Regular",
    weight: 5,
    fee: 200,
    status: "Ready",
    paymentStatus: "paid",
    arrivalDateTime: "2026-09-14 16:30",
    dropOffDate: "2026-09-14",
    addOns: [],
  },
];

describe("ClaimVerificationPage Name Suggestions", () => {
  it("suggests matching customer names only when order status is Ready", () => {
    render(
      <ClaimVerificationPage
        transactions={mockTransactions}
        onUpdateTransaction={vi.fn()}
        onResolveScannedValue={vi.fn().mockResolvedValue(null)}
      />
    );

    const input = screen.getByPlaceholderText(/claim code, ticket id, or customer name/i);

    // Type first letter "J"
    fireEvent.change(input, { target: { value: "j" } });

    // Suggestions dropdown should appear with Ready customers (Juan Dela Cruz, Jenny Santos)
    // but exclude Washing customer (Jane Doe) and Received customer (Alice Smith)
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options.length).toBe(2);
    expect(options[0]).toHaveTextContent("Juan Dela Cruz");
    expect(options[0]).toHaveTextContent("#TKT-0030");
    expect(options[1]).toHaveTextContent("Jenny Santos");
    expect(options[1]).toHaveTextContent("#TKT-0033");

    // Washing customer Jane Doe should not be suggested
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
    expect(screen.queryByText("#TKT-0031")).not.toBeInTheDocument();
  });

  it("selects a customer when clicking on a suggestion item", () => {
    render(
      <ClaimVerificationPage
        transactions={mockTransactions}
        onUpdateTransaction={vi.fn()}
        onResolveScannedValue={vi.fn().mockResolvedValue(null)}
      />
    );

    const input = screen.getByPlaceholderText(/claim code, ticket id, or customer name/i);
    fireEvent.change(input, { target: { value: "ju" } });

    // Click on Juan Dela Cruz suggestion
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Juan Dela Cruz");
    fireEvent.click(options[0]);

    // Suggestions dropdown closes
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // The transaction details card opens immediately showing Juan Dela Cruz
    expect(screen.getAllByText(/TKT-0030/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Juan Dela Cruz/).length).toBeGreaterThan(0);
    expect(screen.getByText(/160/)).toBeInTheDocument();
  });

  it("navigates suggestions with arrow keys and selects with Enter", () => {
    render(
      <ClaimVerificationPage
        transactions={mockTransactions}
        onUpdateTransaction={vi.fn()}
        onResolveScannedValue={vi.fn().mockResolvedValue(null)}
      />
    );

    const input = screen.getByPlaceholderText(/claim code, ticket id, or customer name/i);
    fireEvent.change(input, { target: { value: "j" } });

    // Press Down Arrow to highlight first item (Juan)
    fireEvent.keyDown(input, { key: "ArrowDown" });
    // Press Down Arrow to highlight second item (Jenny)
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Press Enter to select
    fireEvent.keyDown(input, { key: "Enter" });

    // Suggestions dropdown closes and Jenny Santos's ticket is loaded
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getAllByText(/TKT-0033/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Jenny Santos/).length).toBeGreaterThan(0);
  });

  it("closes suggestions when pressing Escape", () => {
    render(
      <ClaimVerificationPage
        transactions={mockTransactions}
        onUpdateTransaction={vi.fn()}
        onResolveScannedValue={vi.fn().mockResolvedValue(null)}
      />
    );

    const input = screen.getByPlaceholderText(/claim code, ticket id, or customer name/i);
    fireEvent.change(input, { target: { value: "j" } });

    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders the Verification History section", () => {
    render(
      <ClaimVerificationPage
        transactions={mockTransactions}
        onUpdateTransaction={vi.fn()}
        onResolveScannedValue={vi.fn().mockResolvedValue(null)}
      />
    );

    expect(screen.getByText("Verification History")).toBeInTheDocument();
  });

  it("displays verified order details when a ticket is looked up", async () => {
    render(
      <ClaimVerificationPage
        transactions={mockTransactions}
        onUpdateTransaction={vi.fn()}
        onResolveScannedValue={vi.fn().mockResolvedValue("TKT-0030")}
      />
    );

    const input = screen.getByPlaceholderText(/claim code, ticket id, or customer name/i);
    fireEvent.change(input, { target: { value: "TKT-0030" } });
    const searchButton = screen.getByRole("button", { name: /^Search$/i });
    fireEvent.click(searchButton);

    const matches = await screen.findAllByText(/Juan Dela Cruz/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("handles scanning an already claimed ticket by displaying claimed notice", async () => {
    const claimedTransactions: Transaction[] = [
      ...mockTransactions,
      {
        id: "tx-claimed",
        ticketId: "TKT-9999",
        customerName: "Claimed Customer",
        status: "Claimed",
        phone: "09170000000",
        washType: "Regular",
        weight: 3,
        fee: 120,
        paymentStatus: "paid",
        arrivalDateTime: "2026-09-14 10:00",
        dropOffDate: "2026-09-14",
        addOns: [],
      },
    ];

    render(
      <ClaimVerificationPage
        transactions={claimedTransactions}
        onUpdateTransaction={vi.fn()}
        onResolveScannedValue={vi.fn().mockResolvedValue("TKT-9999")}
      />
    );

    const input = screen.getByPlaceholderText(/claim code, ticket id, or customer name/i);
    fireEvent.change(input, { target: { value: "TKT-9999" } });
    const searchButton = screen.getByRole("button", { name: /^Search$/i });
    fireEvent.click(searchButton);

    expect(await screen.findByText(/already been claimed/i)).toBeInTheDocument();
  });

  it("does not show claim verification card for non-ready orders and displays not ready notice", async () => {
    render(
      <ClaimVerificationPage
        transactions={mockTransactions}
        onUpdateTransaction={vi.fn()}
        onResolveScannedValue={vi.fn().mockResolvedValue(null)}
      />
    );

    const input = screen.getByPlaceholderText(/claim code, ticket id, or customer name/i);
    // Search for Alice Smith (status: Received, TKT-0032)
    fireEvent.change(input, { target: { value: "Alice Smith" } });
    const searchButton = screen.getByRole("button", { name: /^Search$/i });
    fireEvent.click(searchButton);

    // Should display the "Order Not Ready for Pickup" notice
    expect(await screen.findByText(/Order Not Ready for Pickup/i)).toBeInTheDocument();
    expect(screen.getByText(/is currently in "Received" stage/i)).toBeInTheDocument();

    // The claim action button and verification details should NOT be rendered
    expect(screen.queryByRole("button", { name: /Confirm Claim & Release/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Awaiting estimate/i)).not.toBeInTheDocument();
  });

  it("displays not ready notice when scanning a ticket currently in Washing status", async () => {
    render(
      <ClaimVerificationPage
        transactions={mockTransactions}
        onUpdateTransaction={vi.fn()}
        onResolveScannedValue={vi.fn().mockResolvedValue("TKT-0031")}
      />
    );

    const input = screen.getByPlaceholderText(/claim code, ticket id, or customer name/i);
    fireEvent.change(input, { target: { value: "TKT-0031" } });
    const searchButton = screen.getByRole("button", { name: /^Search$/i });
    fireEvent.click(searchButton);

    expect(await screen.findByText(/Order Not Ready for Pickup/i)).toBeInTheDocument();
    expect(screen.getByText(/is currently in "Washing" stage/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirm Claim & Release/i })).not.toBeInTheDocument();
  });
});

