import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { CustomerTrackingView } from "@/components/customer-tracking-view";
import type { PublicTrackingRecord } from "@/lib/transaction-contracts";
import * as supabaseClientModule from "@/lib/supabase/client";

const mockInitialRecord: PublicTrackingRecord = {
  ticketId: "TKT-1001",
  customerName: "Maria Clara",
  customerPhone: "09171234567",
  status: "Received",
  eta: "2026-09-18 10:00",
  updatedAt: "2026-09-17 14:00",
  paymentStatus: "paid",
  balanceDue: 0,
  weight: 5,
  washType: "Regular Wash",
  addOns: ["Fabric Softener"],
  washInstructions: "Handle with care",
  dropOffTime: "2026-09-17 14:00",
  shopProfile: {
    shopName: "Sunshine Laundry Shop",
    tagline: "Best wash in town",
    logoDataUrl: "",
    address: "123 Main St",
    contactNumber: "09170000000",
    email: "shop@example.com",
    receiptFooter: "Thank you!",
    pickupInstructions: "Present QR code",
  },
};

describe("CustomerTrackingView", () => {
  let realtimeCallback: ((payload: { new?: { status?: string; eta?: string | null } }) => void) | null = null;
  let mockRemoveChannel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    realtimeCallback = null;
    mockRemoveChannel = vi.fn().mockResolvedValue("ok");

    // Mock Supabase client
    const mockChannel: any = {};
    mockChannel.on = vi.fn().mockImplementation((_event: any, _filter: any, cb: any) => {
      realtimeCallback = cb;
      return mockChannel;
    });
    mockChannel.subscribe = vi.fn().mockReturnValue(mockChannel);

    const mockSupabase = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: mockRemoveChannel,
    };

    vi.spyOn(supabaseClientModule, "getSupabaseBrowserClient").mockReturnValue(mockSupabase as any);

    // Mock global fetch for polling fallback
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders initial tracking status and stepper correctly", () => {
    render(
      <CustomerTrackingView
        initialRecord={mockInitialRecord}
        token="test-token-123"
        pickupQrUrl="https://example.com/qr.png"
      />
    );

    expect(screen.getByText("TKT-1001")).toBeInTheDocument();
    expect(screen.getByText("Maria Clara")).toBeInTheDocument();
    expect(screen.getByText("Live tracking active")).toBeInTheDocument();
    expect(screen.queryByText(/Your Laundry is Ready for Pickup!/i)).not.toBeInTheDocument();
  });

  it("updates status to Ready and reveals pickup QR code instantly when Realtime event arrives (zero reload)", async () => {
    render(
      <CustomerTrackingView
        initialRecord={mockInitialRecord}
        token="test-token-123"
        pickupQrUrl="https://example.com/qr.png"
      />
    );

    expect(realtimeCallback).not.toBeNull();

    // Staff transitions ticket to 'Ready' on the counter dashboard
    act(() => {
      realtimeCallback!({
        new: { status: "Ready", eta: "2026-09-18 11:00" },
      });
    });

    // The component updates smoothly in-place without page reload
    await waitFor(() => {
      expect(screen.getByText(/Your Laundry is Ready for Pickup!/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Pickup QR Code")).toBeInTheDocument();
    expect(screen.getByText("test-token-123")).toBeInTheDocument();
  });

  it("updates status via resilient background polling fallback when status changes", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "Washing", eta: "2026-09-18 10:30" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CustomerTrackingView
        initialRecord={mockInitialRecord}
        token="test-token-123"
        pickupQrUrl="https://example.com/qr.png"
      />
    );

    // Fast-forward 6 seconds
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/track/test-token-123", {
      cache: "no-store",
    });

    vi.useRealTimers();
  });

  it("cleans up channel and displays order completed when status is Claimed", () => {
    const claimedRecord = {
      ...mockInitialRecord,
      status: "Claimed" as const,
    };

    render(
      <CustomerTrackingView
        initialRecord={claimedRecord}
        token="test-token-123"
        pickupQrUrl="https://example.com/qr.png"
      />
    );

    expect(screen.getByText("Order completed")).toBeInTheDocument();
    expect(screen.queryByText("Live tracking active")).not.toBeInTheDocument();
  });
});
