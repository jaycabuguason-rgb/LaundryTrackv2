/**
 * Utility for printing thermal receipts and QR tags using an off-screen rendered iframe.
 *
 * Modern Chromium and WebKit browsers strictly reject or silently ignore .print()
 * calls on iframes that have visibility: hidden, display: none, or 0x0 dimensions
 * because they are excluded from the compositor's layout tree.
 *
 * This module creates a fresh off-screen rendered iframe (top: -9999px, opacity: 0)
 * with non-zero dimensions to ensure full rendering and reliable print triggering.
 */

export interface PrintThermalOptions {
  /** Maximum milliseconds to wait for embedded images (e.g. logos/QR codes) to load */
  imageWaitTimeoutMs?: number;
}

export async function printThermalDocument(
  html: string,
  options: PrintThermalOptions = {}
): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const { imageWaitTimeoutMs = 3500 } = options;

  // 1. Clean up any previous print iframe to avoid stale document state
  const existingFrame = document.getElementById("thermal-print-frame");
  if (existingFrame) {
    try {
      existingFrame.remove();
    } catch {
      // ignore
    }
  }

  // 2. Create a clean, off-screen, rendered iframe
  const iframe = document.createElement("iframe");
  iframe.id = "thermal-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "400px";
  iframe.style.height = "600px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-9999";

  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return false;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // 3. Wait for any embedded images (logo or QR code) with adequate timeout
    // and decoding to ensure the image is painted before the print dialog opens
    const images = Array.from(doc.images);
    if (images.length > 0) {
      await Promise.race([
        Promise.all(
          images.map((img) => {
            if (img.complete && img.naturalWidth > 0) {
              if (typeof img.decode === "function") {
                return img.decode().catch(() => {});
              }
              return Promise.resolve();
            }
            return new Promise<void>((resolve) => {
              const onDone = async () => {
                if (typeof img.decode === "function") {
                  try {
                    await img.decode();
                  } catch {
                    // ignore
                  }
                }
                resolve();
              };
              img.onload = onDone;
              img.onerror = () => resolve();
            });
          })
        ),
        new Promise<void>((resolve) => setTimeout(resolve, imageWaitTimeoutMs)),
      ]);
    }

    // 4. Trigger print
    return await new Promise<boolean>((resolve) => {
      setTimeout(() => {
        try {
          const win = iframe.contentWindow;
          if (!win) {
            iframe.remove();
            resolve(false);
            return;
          }

          const cleanup = () => {
            try {
              iframe.remove();
            } catch {
              // ignore
            }
          };

          win.onafterprint = cleanup;
          // Fallback cleanup if onafterprint is unsupported or cancelled
          setTimeout(cleanup, 60000);

          if (typeof win.focus === "function") {
            try {
              win.focus();
            } catch {
              // ignore environments without focus
            }
          }

          if (typeof win.print === "function") {
            try {
              win.print();
            } catch {
              // ignore environments without print
            }
          }

          resolve(true);
        } catch (err) {
          console.error("Thermal print failed:", err);
          iframe.remove();
          resolve(false);
        }
      }, 50);
    });
  } catch (err) {
    console.error("Failed to prepare thermal print frame:", err);
    try {
      iframe.remove();
    } catch {
      // ignore
    }
    return false;
  }
}
