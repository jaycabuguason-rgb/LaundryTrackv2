import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetPublicTrackingRecord = vi.fn();

vi.mock("@/lib/server/laundry-repository", () => ({
  getPublicTrackingRecord: (...args: unknown[]) => mockGetPublicTrackingRecord(...args),
}));

import { GET } from "@/app/api/track/[token]/route";

describe("GET /api/track/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when token is empty or whitespace", async () => {
    const request = new Request("http://localhost:3000/api/track/%20");
    const response = await GET(request, { params: Promise.resolve({ token: "   " }) });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Token is required.");
  });

  it("returns 404 when tracking record is not found", async () => {
    mockGetPublicTrackingRecord.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/track/invalid-token");
    const response = await GET(request, { params: Promise.resolve({ token: "invalid-token" }) });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Tracking record not found.");
  });

  it("returns 200 with status, eta, and payment details when found", async () => {
    mockGetPublicTrackingRecord.mockResolvedValue({
      ticketId: "TKT-0010",
      customerName: "Juan Dela Cruz",
      status: "Washing",
      eta: "2026-09-18 15:00",
      updatedAt: "2026-09-17 12:00",
      paymentStatus: "paid",
      balanceDue: 0,
      weight: 4,
      washType: "Regular",
      addOns: [],
      washInstructions: null,
      dropOffTime: "2026-09-17 10:00",
      shopProfile: {
        shopName: "Sunshine Laundry",
        address: "123 St",
        contactNumber: "123",
        email: "test@example.com",
        pickupInstructions: "Claim at counter",
      },
    });

    const request = new Request("http://localhost:3000/api/track/valid-token");
    const response = await GET(request, { params: Promise.resolve({ token: "valid-token" }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      status: "Washing",
      eta: "2026-09-18 15:00",
      updatedAt: "2026-09-17 12:00",
      paymentStatus: "paid",
      balanceDue: 0,
    });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
