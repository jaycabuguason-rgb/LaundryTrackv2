import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printThermalDocument } from "@/lib/thermal-printer";

describe("printThermalDocument", () => {
  beforeEach(() => {
    // Clean up DOM
    const frame = document.getElementById("thermal-print-frame");
    if (frame) frame.remove();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const frame = document.getElementById("thermal-print-frame");
    if (frame) frame.remove();
  });

  it("creates an off-screen rendered iframe with non-zero dimensions and triggers print", async () => {
    const printSpy = vi.fn();
    const focusSpy = vi.fn();

    // Mock createElement to spy on iframe window methods
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === "iframe") {
        const iframe = el as HTMLIFrameElement;
        // Mock contentWindow
        Object.defineProperty(iframe, "contentWindow", {
          configurable: true,
          get: () => ({
            document: {
              open: vi.fn(),
              write: vi.fn(),
              close: vi.fn(),
              images: [],
            },
            focus: focusSpy,
            print: printSpy,
            onafterprint: null,
          }),
        });
      }
      return el;
    });

    const sampleHtml = "<html><body><h1>Thermal Receipt</h1></body></html>";
    const result = await printThermalDocument(sampleHtml, { imageWaitTimeoutMs: 10 });

    expect(result).toBe(true);
    expect(focusSpy).toHaveBeenCalled();
    expect(printSpy).toHaveBeenCalled();

    // Verify the iframe styling is off-screen rendered (not visibility: hidden, not 0x0)
    const iframe = document.getElementById("thermal-print-frame") as HTMLIFrameElement;
    if (iframe) {
      expect(iframe.style.position).toBe("fixed");
      expect(iframe.style.top).toBe("-9999px");
      expect(iframe.style.left).toBe("-9999px");
      expect(iframe.style.width).toBe("400px");
      expect(iframe.style.height).toBe("600px");
      expect(iframe.style.visibility).not.toBe("hidden");
    }
  });

  it("removes any existing print frame before creating a fresh one", async () => {
    const oldFrame = document.createElement("iframe");
    oldFrame.id = "thermal-print-frame";
    document.body.appendChild(oldFrame);

    expect(document.getElementById("thermal-print-frame")).not.toBeNull();

    await printThermalDocument("<p>Test</p>", { imageWaitTimeoutMs: 10 });

    const frames = document.querySelectorAll("#thermal-print-frame");
    expect(frames.length).toBeLessThanOrEqual(1);
  });
});
