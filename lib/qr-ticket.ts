"use client";

import type { Transaction } from "@/lib/data";
import type { BusinessProfile } from "@/lib/settings-store";
import { maskPhoneNumber } from "@/lib/phone-mask";
import { printThermalDocument } from "@/lib/thermal-printer";
import {
  generateQrSvgString,
  generateQrDataUrl,
  generateQrMatrix,
} from "@/lib/qr-generator";

export function getTrackingUrl(transaction: Transaction): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://laundrytrack.ph";
  const path = transaction.publicTrackingToken
    ? `/track/${transaction.publicTrackingToken}`
    : `/ticket/${transaction.ticketId}`;
  return `${origin}${path}`;
}

/**
 * Returns a synchronous Data URL containing the vector SVG QR code.
 * Safe for immediate display with 0ms network latency.
 */
export function getQrCodeImageUrl(transaction: Transaction, size = 300): string {
  const fullUrl = getTrackingUrl(transaction);
  return generateQrDataUrl(fullUrl, { size });
}

/**
 * Download the QR code as a PNG image directly to the user's computer.
 * Generated 100% locally via Canvas / SVG without external server dependencies.
 */
export async function downloadQrCodeImage(transaction: Transaction, size = 600): Promise<void> {
  const fullUrl = getTrackingUrl(transaction);

  if (typeof document === "undefined") return;

  try {
    const matrix = generateQrMatrix(fullUrl, "M");
    const margin = 2;
    const totalModules = matrix.size + margin * 2;
    const modulePx = Math.max(1, Math.floor(size / totalModules));
    const canvasSize = totalModules * modulePx;

    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      ctx.fillStyle = "#000000";

      for (let r = 0; r < matrix.size; r++) {
        for (let c = 0; c < matrix.size; c++) {
          if (matrix.modules[r][c]) {
            ctx.fillRect((c + margin) * modulePx, (r + margin) * modulePx, modulePx, modulePx);
          }
        }
      }

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `QR-${transaction.ticketId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, "image/png");
      return;
    }
  } catch (err) {
    console.error("Canvas QR export error, falling back to SVG blob:", err);
  }

  // Fallback: direct SVG blob download
  try {
    const svgStr = generateQrSvgString(fullUrl, { size, margin: 2 });
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QR-${transaction.ticketId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to download QR code image:", err);
  }
}

/**
 * Print a compact QR Ticket (bag tag / claim slip) WITHOUT the full sales receipt.
 * Perfectly formatted for 80mm or 58mm thermal printers.
 * Uses inline vector SVG so the QR code renders instantly with zero network delay.
 */
export async function printQrTicketOnly(
  transaction: Transaction,
  profile: BusinessProfile,
  paperWidth: "80mm" | "58mm" = "80mm"
): Promise<void> {
  const is58 = paperWidth === "58mm";
  const printableWidth = is58 ? "48mm" : "72mm";
  const qrSizePx = is58 ? 140 : 180;
  const fullUrl = getTrackingUrl(transaction);
  const qrSvg = generateQrSvgString(fullUrl, { size: qrSizePx, margin: 1 });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>QR Tag — #${transaction.ticketId}</title>
  <style>
    @page {
      size: auto;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      background-color: #ffffff !important;
      color: #000000 !important;
      font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
      font-size: ${is58 ? "11px" : "12px"};
      line-height: 1.3;
      width: ${printableWidth};
      max-width: ${printableWidth};
      margin: 0 auto;
      padding: ${is58 ? "2mm 1mm" : "3mm 2mm"};
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider-dashed {
      border-top: 1px dashed #000000;
      margin: 4px 0;
    }
    .divider-double {
      border-top: 2px solid #000000;
      margin: 5px 0;
    }
    .tag-header {
      font-size: ${is58 ? "9px" : "10px"};
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .shop-name {
      font-size: ${is58 ? "13px" : "15px"};
      font-weight: bold;
      margin-bottom: 2px;
    }
    .ticket-box {
      border: 2px solid #000;
      border-radius: 4px;
      padding: 4px 2px;
      margin: 5px 0;
      background: #f9f9f9;
    }
    .ticket-id {
      font-size: ${is58 ? "18px" : "22px"};
      font-weight: 900;
      letter-spacing: 1px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
      font-size: ${is58 ? "10px" : "11px"};
    }
    .qr-box {
      margin: 8px auto 4px auto;
      text-align: center;
    }
    .qr-box svg {
      width: ${qrSizePx}px !important;
      height: ${qrSizePx}px !important;
      display: block;
      margin: 0 auto;
      shape-rendering: crispEdges;
    }
    .caption {
      font-size: ${is58 ? "9px" : "10px"};
      margin-top: 4px;
    }
    .cutter-clearance {
      height: 18mm;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="center tag-header">[ LAUNDRY BAG / CLAIM TAG ]</div>
  <div class="center shop-name">${profile.shopName || "LaundryTrack"}</div>
  ${profile.contactNumber ? `<div class="center" style="font-size: 9px;">Tel: ${profile.contactNumber}</div>` : ""}

  <div class="divider-double"></div>

  <div class="center ticket-box">
    <div class="ticket-id">#${transaction.ticketId}</div>
    <div style="font-size: 9px; color: #333;">${transaction.arrivalDateTime}</div>
  </div>

  <div class="detail-row">
    <span class="bold">Customer:</span>
    <span class="bold">${transaction.customerName}</span>
  </div>
  ${transaction.phone ? `
  <div class="detail-row">
    <span>Phone:</span>
    <span>${maskPhoneNumber(transaction.phone)}</span>
  </div>` : ""}
  <div class="detail-row">
    <span>Service:</span>
    <span class="bold">${transaction.washType}</span>
  </div>
  <div class="detail-row">
    <span>${transaction.weight > 0 ? "Weight:" : "Loads:"}</span>
    <span>${transaction.weight > 0 ? `${transaction.weight} kg` : "Per Load"}</span>
  </div>

  <div class="divider-dashed"></div>

  <div class="qr-box">
    <div style="display:flex; justify-content:center; align-items:center;">
      ${qrSvg}
    </div>
    <div class="caption bold">SCAN TO TRACK STATUS</div>
    <div class="caption">Attach this tag to bag or give to customer</div>
  </div>

  <div class="divider-dashed"></div>
  <div class="center" style="font-size: 8px; color: #555;">LaundryTrack QR System</div>

  <div class="cutter-clearance"></div>
</body>
</html>`;

  await printThermalDocument(html);
}
