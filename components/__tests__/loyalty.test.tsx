import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoyaltyPage from "@/components/pages/loyalty";
import type { LoyaltyMember } from "@/lib/data";

const mockMembers: LoyaltyMember[] = [
  {
    id: "mem-1",
    name: "Alice Santos",
    phone: "09171234567",
    stampCount: 5,
    rewardsRedeemed: 1,
    preferences: "Extra soft fabcon",
    stampHistory: [
      { date: "2026-09-01", ticket: "TKT-0010", stamps: 2 },
      { date: "2026-09-08", ticket: "TKT-0015", stamps: 3 },
    ],
    rewardHistory: [
      { date: "2026-08-20", reward: "Free Wash" },
    ],
  },
  {
    id: "mem-2",
    name: "Bob Reyes",
    phone: "09189876543",
    stampCount: 1,
    rewardsRedeemed: 0,
    preferences: "Fold only",
    stampHistory: [
      { date: "2026-09-10", ticket: "TKT-0020", stamps: 1 },
    ],
    rewardHistory: [],
  },
  {
    id: "mem-3",
    name: "Charlie Cruz",
    phone: "09191112222",
    stampCount: 0,
    rewardsRedeemed: 0,
    preferences: "",
    stampHistory: [],
    rewardHistory: [],
  },
];

const mockRefetch = vi.fn();

vi.mock("@/hooks/use-loyalty-members", () => ({
  useLoyaltyMembers: () => ({
    members: mockMembers,
    loading: false,
    refetch: mockRefetch,
  }),
}));

vi.mock("@/lib/supabase/browser-session", () => ({
  getBrowserAccessToken: vi.fn().mockResolvedValue("test-token"),
  refreshBrowserSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("boneyard-js/react", () => ({
  Skeleton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("LoyaltyPage Mobile Concept Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, member: mockMembers[0] }),
    });
  });

  it("renders mobile header, Add Member button, and 3 key metrics cards", () => {
    render(<LoyaltyPage />);

    // Header & Subtitle
    expect(screen.getAllByText("Members & Rewards").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Manage customer loyalty points, rewards, and program rules").length
    ).toBeGreaterThanOrEqual(1);

    // Add Member button
    expect(screen.getAllByRole("button", { name: /add member/i }).length).toBeGreaterThanOrEqual(1);

    // 3 Key Metrics (Total Members = 3, Stamps Issued = 6, Claimed = 1)
    expect(screen.getAllByText("Total Members").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Stamps Issued").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Claimed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("6").length).toBeGreaterThanOrEqual(1);
  });

  it("renders active campaign micro-banner with current rules", () => {
    render(<LoyaltyPage />);

    expect(screen.getAllByText("Active Shop Campaign").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Auto-redeemed at checkout on standard cycles/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("switches between Members and Rewards & Rules tabs", () => {
    render(<LoyaltyPage />);

    const rewardsTabs = screen.getAllByRole("button", { name: /rewards & rules/i });
    expect(rewardsTabs.length).toBeGreaterThanOrEqual(1);

    // Click mobile Rewards & Rules tab
    fireEvent.click(rewardsTabs[0]);

    // Rewards & Rules content rendered
    expect(screen.getAllByText("Loyalty Program Configuration").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Active Reward Perks").length).toBeGreaterThanOrEqual(1);

    // Click back to Members tab
    const membersTabs = screen.getAllByRole("button", { name: /members/i });
    fireEvent.click(membersTabs[0]);

    expect(screen.getAllByText("Alice Santos").length).toBeGreaterThanOrEqual(1);
  });

  it("filters members list by search input and allows clearing query", () => {
    render(<LoyaltyPage />);

    const searchInputs = screen.getAllByLabelText(/search member name or phone/i);
    const mobileSearchInput = searchInputs[0];

    // Filter by name
    fireEvent.change(mobileSearchInput, { target: { value: "Bob" } });

    expect(screen.getAllByText("Bob Reyes").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Alice Santos")).not.toBeInTheDocument();

    // Clear search using clear button
    const clearBtn = screen.getByRole("button", { name: /clear search/i });
    fireEvent.click(clearBtn);

    expect(screen.getAllByText("Alice Santos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Bob Reyes").length).toBeGreaterThanOrEqual(1);
  });

  it("opens QR modal, drills down to view details, and returns via back button", () => {
    render(<LoyaltyPage />);

    // Click QR button for Alice Santos
    const qrButtons = screen.getAllByRole("button", { name: /view qr status for alice santos/i });
    fireEvent.click(qrButtons[0]);

    // QR modal opens
    expect(screen.getByText(/Member QR & Status Card/i)).toBeInTheDocument();

    // Close QR modal
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);

    // Click View Details for Alice Santos (first View Details button in mobile card)
    const viewDetailsButtons = screen.getAllByRole("button", { name: /view details/i });
    fireEvent.click(viewDetailsButtons[0]);

    // Drilldown view opens
    expect(screen.getByText("Laundry Records & History")).toBeInTheDocument();
    expect(screen.getByText("Redeemed Rewards History")).toBeInTheDocument();

    // Click Back button
    const backBtn = screen.getByRole("button", { name: /back/i });
    fireEvent.click(backBtn);

    // Back in main members list
    expect(screen.getAllByText("Active Shop Campaign").length).toBeGreaterThanOrEqual(1);
  });

  it("triggers direct stamp addition when clicking Add Stamp button", async () => {
    render(<LoyaltyPage />);

    // In mobile card: button contains "+ Add Stamp" or "Add Stamp"
    const addStampButtons = screen.getAllByRole("button", { name: /add stamp/i });
    expect(addStampButtons.length).toBeGreaterThanOrEqual(1);

    // Click Add Stamp on Alice's card
    fireEvent.click(addStampButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/loyalty/mem-1/stamps"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
