import { describe, it, expect } from "vitest";
import { generateQrMatrix, generateQrSvgString, generateQrDataUrl } from "@/lib/qr-generator";

describe("qr-generator", () => {
  const sampleUrl = "https://laundrytrack.ph/track/tk_sample_123456";

  it("generates a valid QR matrix for URLs", () => {
    const result = generateQrMatrix(sampleUrl);
    expect(result.size).toBeGreaterThan(20);
    expect(result.modules.length).toBe(result.size);
    expect(result.modules[0].length).toBe(result.size);

    // Verify finder patterns exist at corners
    // Top-left finder pattern center (row 3, col 3) is always true
    expect(result.modules[3][3]).toBe(true);
    // Top-right finder pattern center
    expect(result.modules[3][result.size - 4]).toBe(true);
    // Bottom-left finder pattern center
    expect(result.modules[result.size - 4][3]).toBe(true);
  });

  it("generates crisp SVG markup with crispEdges and correct viewBox", () => {
    const svg = generateQrSvgString(sampleUrl, { size: 120, margin: 2 });
    expect(svg).toContain("<svg");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 ');
    expect(svg).toContain('width="120" height="120"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain("<path");
  });

  it("generates a synchronous Data URL", () => {
    const dataUrl = generateQrDataUrl(sampleUrl, { size: 100 });
    expect(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(dataUrl).toContain(encodeURIComponent("<svg"));
  });

  it("handles different error correction levels", () => {
    const resL = generateQrMatrix(sampleUrl, "L");
    const resH = generateQrMatrix(sampleUrl, "H");
    expect(resL.size).toBeDefined();
    expect(resH.size).toBeDefined();
  });
});
