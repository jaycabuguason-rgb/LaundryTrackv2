"use client";

import type { Transaction } from "@/lib/data";
import type { BusinessProfile } from "@/lib/settings-store";
import { maskPhoneNumber } from "@/lib/phone-mask";

export function getTrackingUrl(transaction: Transaction): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://laundrytrack.ph";
  const path = transaction.publicTrackingToken
    ? `/track/${transaction.publicTrackingToken}`
    : `/ticket/${transaction.ticketId}`;
  return `${origin}${path}`;
}

export function getQrCodeImageUrl(transaction: Transaction, size = 300): string {
  const fullUrl = getTrackingUrl(transaction);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=1&data=${encodeURIComponent(fullUrl)}`;
}

/**
 * Download the QR code as a PNG image directly to the user's computer.
 */
export async function downloadQrCodeImage(transaction: Transaction, size = 600): Promise<void> {
  const qrUrl = getQrCodeImageUrl(transaction, size);
  try {
    const res = await fetch(qrUrl);
    if (!res.ok) throw new Error("Failed to fetch QR image");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QR-${transaction.ticketId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // Fallback: direct download link or new tab
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `QR-${transaction.ticketId}.png`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Print a compact QR Ticket (bag tag / claim slip) WITHOUT the full sales receipt.
 * Perfectly formatted for 80mm or 58mm thermal printers.
 */
export async function printQrTicketOnly(
  transaction: Transaction,
  profile: BusinessProfile,
  paperWidth: "80mm" | "58mm" = "80mm"
): Promise<void> {
  const is58 = paperWidth === "58mm";
  const printableWidth = is58 ? "48mm" : "72mm";
  const qrSizePx = is58 ? 140 : 180;
  const qrSrc = getQrCodeImageUrl(transaction, qrSizePx * 2);

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
    .qr-img {
      width: ${qrSizePx}px;
      height: ${qrSizePx}px;
      display: block;
      margin: 0 auto;
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
    <img src="${qrSrc}" alt="QR code" class="qr-img" crossOrigin="anonymous" />
    <div class="caption bold">SCAN TO TRACK STATUS</div>
    <div class="caption">Attach this tag to bag or give to customer</div>
  </div>

  <div class="divider-dashed"></div>
  <div class="center" style="font-size: 8px; color: #555;">LaundryTrack QR System</div>

  <div class="cutter-clearance"></div>
</body>
</html>`;

  try {
    let iframe = document.getElementById("thermal-print-frame") as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "thermal-print-frame";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.style.visibility = "hidden";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) throw new Error("Unable to access print frame");

    doc.open();
    doc.write(html);
    doc.close();

    const images = Array.from(doc.images);
    if (images.length > 0) {
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) resolve();
              else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(resolve, 1500);
              }
            })
        )
      );
    }

    setTimeout(() => {
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch {
        const win = window.open("", "_blank", "width=380,height=550");
        if (win) {
          win.document.open();
          win.document.write(html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 350);
        }
      }
    }, 200);
  } catch {
    const win = window.open("", "_blank", "width=380,height=550");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 350);
    }
  }
}

