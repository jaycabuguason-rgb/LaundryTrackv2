import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PublicTrackingPage from "../page";
import type { PublicTrackingRecord } from "@/lib/transaction-contracts";

const mockGetPublicTrackingRecord = vi.fn();
const mockGetLoyaltySettings = vi.fn();
const mockGetPublicLoyaltyMemberRecord = vi.fn();

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["host", "localhost:3000"]])),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("@/lib/server/laundry-repository", () => ({
  getPublicTrackingRecord: (...args: unknown[]) => mockGetPublicTrackingRecord(...args),
}));

vi.mock("@/lib/server/loyalty-repository", () => ({
  getLoyaltySettings: (...args: unknown[]) => mockGetLoyaltySettings(...args),
  getPublicLoyaltyMemberRecord: (...args: unknown[]) => mockGetPublicLoyaltyMemberRecord(...args),
}));

const mockRecord: PublicTrackingRecord = {
  ticketId: "TKT-0048",
  customerName: "Juan Dela Cruz",
  customerPhone: "09171234567",
  status: "Ready",
  eta: "2026-09-18 15:00",
  updatedAt: "2026-09-17 12:00",
  paymentStatus: "paid",
  balanceDue: 0,
  weight: 2,
  washType: "Delicate",
  addOns: [],
  washInstructions: null,
  dropOffTime: "2026-09-17 10:00",
  shopProfile: {
    shopName: "Blowing Bubbles",
    tagline: "",
    address: "Apokon, Tagum City",
    contactNumber: "(02) 8123-4567",
    email: "contact@laundrytrack.ph",
    receiptFooter: "Maraming salamat po",
    pickupInstructions: "Present this receipt or QR code upon claiming.",
  },
};

describe("PublicTrackingPage - Loyalty Promotion Banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicTrackingRecord.mockResolvedValue(mockRecord);
  });

  it("shows promotional banner when loyalty program is enabled and user is not a member", async () => {
    mockGetLoyaltySettings.mockResolvedValue({
      loyalty_enabled: true,
      washes_per_reward: 7,
      reward_description: "Free wash",
    });
    mockGetPublicLoyaltyMemberRecord.mockResolvedValue(null);

    const Page = await PublicTrackingPage({
      params: Promise.resolve({ token: "test-token" }),
    });
    render(Page);

    expect(screen.getByText("Earn Free Laundries With Every Wash!")).toBeInTheDocument();
    expect(
      screen.getByText(/Ask our staff to enroll your number into our Loyalty Program/i)
    ).toBeInTheDocument();
  });

  it("hides promotional banner when loyalty program is turned off in settings", async () => {
    mockGetLoyaltySettings.mockResolvedValue({
      loyalty_enabled: false,
      washes_per_reward: 7,
      reward_description: "Free wash",
    });
    mockGetPublicLoyaltyMemberRecord.mockResolvedValue(null);

    const Page = await PublicTrackingPage({
      params: Promise.resolve({ token: "test-token" }),
    });
    render(Page);

    expect(screen.queryByText("Earn Free Laundries With Every Wash!")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Ask our staff to enroll your number into our Loyalty Program/i)
    ).not.toBeInTheDocument();
  });

  it("hides promotional banner when query param loyalty is false", async () => {
    mockGetLoyaltySettings.mockResolvedValue({
      loyalty_enabled: true,
      washes_per_reward: 7,
      reward_description: "Free wash",
    });
    mockGetPublicLoyaltyMemberRecord.mockResolvedValue(null);

    const Page = await PublicTrackingPage({
      params: Promise.resolve({ token: "test-token" }),
      searchParams: Promise.resolve({ loyalty: "false" }),
    });
    render(Page);

    expect(screen.queryByText("Earn Free Laundries With Every Wash!")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Ask our staff to enroll your number into our Loyalty Program/i)
    ).not.toBeInTheDocument();
  });
});
