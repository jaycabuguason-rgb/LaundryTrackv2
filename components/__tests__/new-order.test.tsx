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
    rewardsRedeemed: 1,
    preferences: "Extra soft fabcon",
    stampHistory: [],
    rewardHistory: [],
  },
  {
    id: "mem-2",
    name: "Bob Reyes",
    phone: "09189876543",
    stampCount: 1,
    rewardsRedeemed: 0,
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
});
