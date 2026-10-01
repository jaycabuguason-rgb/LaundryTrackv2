import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTrackingUrl, getQrCodeImageUrl, printQrTicketOnly, downloadQrCodeImage } from "@/lib/qr-ticket";
import { type Transaction } from "@/lib/data";
import { type BusinessProfile } from "@/lib/settings-store";
import * as thermalPrinter from "@/lib/thermal-printer";

const mockTransaction: Transaction = {
  id: "txn-10",
  ticketId: "TKT-0010",
  customerName: "Maria Santos",
  phone: "09987654321",
  washType: "Wash & Fold",
  weight: 5,
  loads: 0,
  fee: 250,
  paymentStatus: "paid",
  status: "Ready for Pickup",
  arrivalDateTime: "2026-10-01 10:00",
  publicTrackingToken: "tk_maria_0010",
  createdAt: "2026-10-01T10:00:00Z",
};

const mockProfile: BusinessProfile = {
  shopName: "LaundryTrack Express",
  tagline: "Fast & Clean",
  address: "Corner Street, Metro Manila",
  contactNumber: "09123456789",
  email: "shop@laundrytrack.ph",
  receiptFooter: "Keep this tag safe",
  pickupInstructions: "Show QR tag upon pickup",
  receiptPaperWidth: "80mm",
  receiptShowLogo: false,
  logoDataUrl: null,
};

describe("qr-ticket utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the correct tracking URL with token", () => {
    const url = getTrackingUrl(mockTransaction);
    expect(url).toContain("/track/tk_maria_0010");
  });

  it("falls back to /ticket/ID when token is missing", () => {
    const noTokenTxn: Transaction = { ...mockTransaction, publicTrackingToken: undefined };
    const url = getTrackingUrl(noTokenTxn);
    expect(url).toContain("/ticket/TKT-0010");
  });

  it("generates a synchronous vector Data URL in getQrCodeImageUrl", () => {
    const dataUrl = getQrCodeImageUrl(mockTransaction, 200);
    expect(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(dataUrl).toContain(encodeURIComponent("<svg"));
    expect(dataUrl).not.toContain("api.qrserver.com");
  });

  it("printQrTicketOnly outputs HTML containing inline vector SVG without remote images", async () => {
    const printSpy = vi.spyOn(thermalPrinter, "printThermalDocument").mockResolvedValue(true);

    await printQrTicketOnly(mockTransaction, mockProfile, "58mm");

    expect(printSpy).toHaveBeenCalledTimes(1);
    const html = printSpy.mock.calls[0][0];

    expect(html).toContain("LAUNDRY BAG / CLAIM TAG");
    expect(html).toContain("#TKT-0010");
    expect(html).toContain("Maria Santos");
    expect(html).toContain("<svg");
    expect(html).toContain('shape-rendering="crispEdges"');
    expect(html).not.toContain("api.qrserver.com");
  });

  it("downloadQrCodeImage triggers blob download without throwing", async () => {
    // Mock URL.createObjectURL and revokeObjectURL
    const mockCreateObjectURL = vi.fn(() => "blob:http://localhost/test-blob");
    const mockRevokeObjectURL = vi.fn();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    // Spy on appendChild and removeChild
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    await expect(downloadQrCodeImage(mockTransaction, 300)).resolves.not.toThrow();

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });
});
