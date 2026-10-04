import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PrintReceiptModal } from "@/components/print-receipt-modal";
import { type Transaction } from "@/lib/data";
import * as thermalPrinter from "@/lib/thermal-printer";

vi.mock("@/lib/settings-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings-store")>();
  return {
    ...actual,
    loadBusinessProfile: vi.fn(() => ({
      shopName: "Blowing Bubbles Laundry Shop",
      tagline: "Quality Care for Your Clothes",
      address: "123 Clean St.",
      contactNumber: "09755245954",
      email: "admin@gmail.com",
      receiptFooter: "Thank you for choosing Blowing Bubbles Laundry Shop!",
      pickupInstructions: "Present this receipt or QR code upon claiming.",
      receiptPaperWidth: "58mm" as const,
      receiptShowLogo: false,
      logoDataUrl: "",
    })),
  };
});

const mockTransaction: Transaction = {
  id: "txn-1",
  ticketId: "TKT-0008",
  customerName: "Jayson",
  phone: "09123456789",
  washType: "Full Package",
  weight: 0,
  loads: 1,
  fee: 175,
  paymentStatus: "paid",
  status: "Washing",
  arrivalDateTime: "2026-10-01 16:37",
  dropOffDate: "2026-10-01",
  addOns: [],
  eta: "2026-10-01 18:37",
  publicTrackingToken: "tk_test_tkt0008",
};

describe("PrintReceiptModal QR Code Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the thermal receipt preview with original QR code image from api.qrserver.com", () => {
    render(
      <PrintReceiptModal
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    // Live preview should render customer and ticket info
    expect(screen.getAllByText("#TKT-0008").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jayson").length).toBeGreaterThan(0);

    // Verify QR code image is rendered with original api.qrserver.com source
    const qrImg = screen.getByAltText("QR for TKT-0008") as HTMLImageElement;
    expect(qrImg).toBeInTheDocument();
    expect(qrImg.src).toContain("api.qrserver.com");
    expect(qrImg.src).toContain("tk_test_tkt0008");
    expect(screen.getByText("Scan with camera to track order")).toBeInTheDocument();
  });

  it("sends thermal document HTML containing the QR code image to printThermalDocument", async () => {
    const printSpy = vi.spyOn(thermalPrinter, "printThermalDocument").mockResolvedValue(true);

    render(
      <PrintReceiptModal
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    // Click "Print Thermal Receipt (58mm)" button
    const printBtn = screen.getByRole("button", { name: /Print Thermal Receipt/i });
    fireEvent.click(printBtn);

    await waitFor(() => {
      expect(printSpy).toHaveBeenCalledTimes(1);
    });

    const printedHtml = printSpy.mock.calls[0][0];
    // Check that printed HTML contains the ticket ID, QR code img, and api.qrserver.com source
    expect(printedHtml).toContain("#TKT-0008");
    expect(printedHtml).toContain("qr-code-img");
    expect(printedHtml).toContain("api.qrserver.com");
    expect(printedHtml).toContain("tk_test_tkt0008");
    expect(printedHtml).toContain("Scan with camera to track order status");
  });

  it("toggling off 'Include QR Code' removes the QR code from print payload", async () => {
    const printSpy = vi.spyOn(thermalPrinter, "printThermalDocument").mockResolvedValue(true);

    render(
      <PrintReceiptModal
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    // Find and uncheck "Include QR Code"
    const qrCheckbox = screen.getByRole("checkbox", { name: /Include QR Code/i });
    expect(qrCheckbox).toBeChecked();
    fireEvent.click(qrCheckbox);
    expect(qrCheckbox).not.toBeChecked();

    // Click print
    const printBtn = screen.getByRole("button", { name: /Print Thermal Receipt/i });
    fireEvent.click(printBtn);

    await waitFor(() => {
      expect(printSpy).toHaveBeenCalledTimes(1);
    });

    const printedHtml = printSpy.mock.calls[0][0];
    expect(printedHtml).not.toContain("api.qrserver.com");
    expect(printedHtml).not.toContain("Scan with camera to track order status");
  });

  it("selects Combo (Receipt + Bag Tag) and prints customer receipt plus bag tag with tear guide", async () => {
    const printSpy = vi.spyOn(thermalPrinter, "printThermalDocument").mockResolvedValue(true);

    render(
      <PrintReceiptModal
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    // Switch to Receipt + Bag Tag combo
    const comboBtn = screen.getByRole("button", { name: /Receipt \+ Bag Tag/i });
    fireEvent.click(comboBtn);

    // Preview should display the tear guide
    expect(screen.getByText(/TEAR HERE FOR BAG TAG/i)).toBeInTheDocument();
    expect(screen.getByText(/LAUNDRY BAG \/ CLAIM TAG/i)).toBeInTheDocument();

    // Primary button should reflect combo mode
    const printComboBtn = screen.getByRole("button", { name: /Print Receipt \+ Bag Tag Combo/i });
    expect(printComboBtn).toBeInTheDocument();
    fireEvent.click(printComboBtn);

    await waitFor(() => {
      expect(printSpy).toHaveBeenCalledTimes(1);
    });

    const printedHtml = printSpy.mock.calls[0][0];
    expect(printedHtml).toContain("CUSTOMER RECEIPT");
    expect(printedHtml).toContain("TEAR HERE FOR BAG TAG");
    expect(printedHtml).toContain("LAUNDRY BAG / CLAIM TAG");
    expect(printedHtml).toContain("Attach this tag to laundry bag");
  });
});
