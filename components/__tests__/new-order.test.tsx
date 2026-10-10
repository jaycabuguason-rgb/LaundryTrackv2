import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NewOrderPage from "@/components/pages/new-order";
import type { LoyaltyMember } from "@/lib/data";

const mockMembers: LoyaltyMember[] = [
  {
    id: "mem-1",
    name: "Alice Santos",
    phone: "09171234567",
    stampCount: 5,
    rewardsAvailable: 0,
    rewardsRedeemed: 1,
    dateJoined: "2026-01-01",
    preferences: "Extra soft fabcon",
    stampHistory: [],
    rewardHistory: [],
  },
  {
    id: "mem-2",
    name: "Bob Reyes",
    phone: "09189876543",
    stampCount: 1,
    rewardsAvailable: 0,
    rewardsRedeemed: 0,
    dateJoined: "2026-01-01",
    preferences: "Fold only",
    stampHistory: [],
    rewardHistory: [],
  },
];

vi.mock("@/hooks/use-loyalty-members", () => ({
  useLoyaltyMembers: () => ({
    members: mockMembers,
    loading: false,
    refetch: vi.fn(),
  }),
}));

describe("NewOrderPage Customer Suggestions", () => {
  it("shows suggestions when typing into the name input", () => {
    render(
      <NewOrderPage
        onCreateTransaction={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText(/customer name/i);
    fireEvent.change(nameInput, { target: { value: "Ali" } });

    expect(screen.getByText(/Existing Loyalty Members/i)).toBeInTheDocument();
    expect(screen.getByText("Alice Santos")).toBeInTheDocument();
  });

  it("does NOT show suggestions when entering phone numbers", () => {
    render(
      <NewOrderPage
        onCreateTransaction={vi.fn()}
      />
    );

    const phoneInput = screen.getByPlaceholderText(/phone number/i);
    fireEvent.change(phoneInput, { target: { value: "0917" } });

    expect(screen.queryByText(/Existing Loyalty Members/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Alice Santos")).not.toBeInTheDocument();
  });

  it("closes suggestions when focusing the phone input", () => {
    render(
      <NewOrderPage
        onCreateTransaction={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText(/customer name/i);
    fireEvent.change(nameInput, { target: { value: "Ali" } });
    expect(screen.getByText(/Existing Loyalty Members/i)).toBeInTheDocument();

    const phoneInput = screen.getByPlaceholderText(/phone number/i);
    fireEvent.focus(phoneInput);

    expect(screen.queryByText(/Existing Loyalty Members/i)).not.toBeInTheDocument();
  });

  it("prevents duplicate submissions when clicking Create Order rapidly", async () => {
    let resolveOrder!: (txn: any) => void;
    const onCreateTransaction = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveOrder = resolve;
      });
    });

    render(<NewOrderPage onCreateTransaction={onCreateTransaction} />);

    // Step 1: fill customer name & advance
    const nameInput = screen.getByPlaceholderText(/customer name/i);
    fireEvent.change(nameInput, { target: { value: "Test Customer" } });
    const nextBtn1 = screen.getByRole("button", { name: /next/i });
    fireEvent.click(nextBtn1);

    // Step 2: fill weight & advance
    const weightInput = screen.getByLabelText(/weight/i);
    fireEvent.change(weightInput, { target: { value: "2.5" } });
    const nextBtn2 = screen.getByRole("button", { name: /next/i });
    fireEvent.click(nextBtn2);

    // Step 3: locate Create Order button
    const createOrderBtn = screen.getByRole("button", { name: /create order/i });
    expect(createOrderBtn).toBeInTheDocument();

    // Rapid double click
    fireEvent.click(createOrderBtn);
    fireEvent.click(createOrderBtn);

    // Expect onCreateTransaction called only once
    expect(onCreateTransaction).toHaveBeenCalledTimes(1);

    // Resolve the promise
    resolveOrder({
      id: "txn-1",
      ticketId: "TKT-0099",
      customerName: "Test Customer",
      status: "Received",
      paymentStatus: "unpaid",
      fee: 75,
      weight: 2.5,
      washType: "Regular",
      addOns: [],
      arrivalDateTime: "2026-10-10 10:00",
      dropOffDate: "2026-10-10",
    });
  });
});
