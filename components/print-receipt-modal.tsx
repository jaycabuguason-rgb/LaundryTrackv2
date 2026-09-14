"use client";

import { useRef, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Loader2, Download, QrCode, Receipt, Settings2, FileDown } from "lucide-react";
import { type Transaction } from "@/lib/data";
import { formatReadableDateTime } from "@/lib/date-format";
import { loadBusinessProfile, type BusinessProfile } from "@/lib/settings-store";
import { downloadQrCodeImage, printQrTicketOnly } from "@/lib/qr-ticket";
import { getReceiptCostBreakdown } from "@/lib/receipt-breakdown";
import { maskPhoneNumber } from "@/lib/phone-mask";

interface PrintReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  /** If true, shows "Transaction created!" header for the post-confirm flow */
  postCreate?: boolean;
}

type PaperWidth = "80mm" | "58mm";

export function PrintReceiptModal({ open, onOpenChange, transaction, postCreate }: PrintReceiptModalProps) {
  const receiptPreviewRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<BusinessProfile>(() => loadBusinessProfile());
  const [paperWidth, setPaperWidth] = useState<PaperWidth>("80mm");
  const [copies, setCopies] = useState<1 | 2>(1);
  const [showLogo, setShowLogo] = useState<boolean>(true);
  const [showQr, setShowQr] = useState<boolean>(true);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Reload business profile & stored paper size whenever modal opens
  useEffect(() => {
    if (open) {
      const p = loadBusinessProfile();
      setProfile(p);
      const savedWidth = localStorage.getItem("laundrytrack_receipt_paper_width") as PaperWidth | null;
      if (savedWidth === "58mm" || savedWidth === "80mm") {
        setPaperWidth(savedWidth);
      } else if (p.receiptPaperWidth === "58mm" || p.receiptPaperWidth === "80mm") {
        setPaperWidth(p.receiptPaperWidth);
      }
      if (typeof p.receiptShowLogo === "boolean") {
        setShowLogo(p.receiptShowLogo);
      }
    }
  }, [open]);

  const handlePaperWidthChange = (width: PaperWidth) => {
    setPaperWidth(width);
    try {
      localStorage.setItem("laundrytrack_receipt_paper_width", width);
    } catch {
      // ignore
    }
  };

  if (!transaction) return null;

  const breakdown = getReceiptCostBreakdown(transaction);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://laundrytrack.ph";
  const trackingPath = transaction.publicTrackingToken
    ? `/track/${transaction.publicTrackingToken}`
    : `/ticket/${transaction.ticketId}`;
  const trackingFullUrl = `${origin}${trackingPath}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(
    trackingFullUrl
  )}`;

  // Generate HTML for a single thermal slip
  const generateSlipHtml = (copyLabel?: string) => {
    return `
      <div class="receipt-slip">
        ${copyLabel ? `
          <div class="center bold copy-tag">[ ${copyLabel} ]</div>
          <div class="divider-dashed"></div>
        ` : ""}

        <!-- Shop Header -->
        ${showLogo && profile.logoDataUrl ? `
          <div class="center logo-container">
            <img src="${profile.logoDataUrl}" alt="Shop Logo" class="shop-logo" />
          </div>
        ` : ""}
        ${profile.shopName ? `<div class="center bold shop-name">${profile.shopName}</div>` : ""}
        ${profile.tagline ? `<div class="center shop-sub">${profile.tagline}</div>` : ""}
        ${profile.address ? `<div class="center shop-sub">${profile.address}</div>` : ""}
        ${profile.contactNumber ? `<div class="center shop-sub">Tel: ${profile.contactNumber}</div>` : ""}
        ${profile.email ? `<div class="center shop-sub">${profile.email}</div>` : ""}

        <div class="divider-double"></div>

        <!-- Ticket & Date -->
        <div class="center bold ticket-id">#${transaction.ticketId}</div>
        <div class="row">
          <span class="label">Date/Time:</span>
          <span class="value">${transaction.arrivalDateTime}</span>
        </div>

        <div class="divider-dashed"></div>

        <!-- Customer Information -->
        <div class="row">
          <span class="label">Customer:</span>
          <span class="value bold">${transaction.customerName}</span>
        </div>
        <div class="row">
          <span class="label">Contact:</span>
          <span class="value">${maskPhoneNumber(transaction.phone)}</span>
        </div>

        <div class="divider-dashed"></div>

        <!-- Service & Load Details -->
        <div class="row">
          <span class="label">Service:</span>
          <span class="value bold">${transaction.washType}</span>
        </div>
        <div class="row">
          <span class="label">${transaction.weight > 0 ? "Weight:" : "Load:"}</span>
          <span class="value">${transaction.weight > 0 ? `${transaction.weight} kg` : "Per Load"}</span>
        </div>
        ${transaction.addOns && transaction.addOns.length > 0 ? `
          <div class="row">
            <span class="label">Add-ons:</span>
            <span class="value">${transaction.addOns.join(", ")}</span>
          </div>
        ` : ""}
        ${transaction.washInstructions ? `
          <div class="instruction-box">
            <span class="label">Note:</span>
            <span class="instruction-text">${transaction.washInstructions}</span>
          </div>
        ` : ""}

        <div class="divider-dashed"></div>

        <!-- Pricing Breakdown -->
        <div class="row">
          <span class="label bold">COST BREAKDOWN</span>
        </div>
        <div class="row">
          <span class="label">${breakdown.serviceName}</span>
          <span class="value">&#8369;${breakdown.serviceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        ${breakdown.serviceDetail ? `
          <div class="row" style="font-size: 9.5px; color: #333; padding-left: 4px; margin-top: -2px;">
            <span>(${breakdown.serviceDetail})</span>
          </div>
        ` : ""}
        ${breakdown.addOns.map((addon) => `
          <div class="row">
            <span class="label">+ Add-on: ${addon.name}</span>
            <span class="value">&#8369;${addon.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        `).join("")}
        <div class="divider-solid"></div>
        <div class="row row-total">
          <span class="bold">TOTAL AMOUNT:</span>
          <span class="bold">&#8369;${transaction.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div class="divider-double"></div>

        <!-- Payment Status (Monochrome thermal high contrast) -->
        <div class="center payment-block">
          ${transaction.paymentStatus === "paid" ? `
            <div class="payment-paid">*** PAID IN FULL ***</div>
          ` : `
            <div class="payment-unpaid">
              <div>*** UNPAID ***</div>
              <div class="balance-line">BALANCE DUE: &#8369;${transaction.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          `}
        </div>

        <div class="divider-dashed"></div>

        <!-- Claim & ETA Information -->
        <div class="row">
          <span class="label">Status:</span>
          <span class="value bold">${transaction.status}</span>
        </div>
        <div class="row">
          <span class="label">Est. Ready:</span>
          <span class="value">${transaction.eta ? formatReadableDateTime(transaction.eta) : "Pending Schedule"}</span>
        </div>

        <!-- Tracking QR Code -->
        ${showQr ? `
          <div class="divider-dashed"></div>
          <div class="center qr-section">
            <img src="${qrUrl}" alt="QR for #${transaction.ticketId}" class="qr-code-img" crossOrigin="anonymous" />
            <div class="qr-caption">Scan with camera to track order status</div>
            <div class="qr-caption bold">Ticket: ${transaction.ticketId}</div>
          </div>
        ` : ""}

        <div class="divider-dashed"></div>

        <!-- Footer / Policy -->
        ${profile.receiptFooter ? `
          <div class="center bold footer-text">${profile.receiptFooter}</div>
        ` : ""}
        <div class="center footer-sub">
          ${profile.pickupInstructions || "Present this receipt or QR code upon claiming."}
        </div>

        <div class="center small-end-note">LaundryTrack POS System</div>
      </div>
    `;
  };

  // Generate full standalone printable HTML
  const generatePrintableHtml = () => {
    const is58 = paperWidth === "58mm";
    const printableWidth = is58 ? "48mm" : "72mm";
    const bodyPadding = is58 ? "1mm 1mm" : "2mm 2mm";
    const fontSize = is58 ? "11px" : "12px";
    const shopNameSize = is58 ? "14px" : "16px";
    const ticketIdSize = is58 ? "16px" : "19px";
    const totalSize = is58 ? "13px" : "15px";
    const qrSize = is58 ? "85px" : "105px";

    const slipsHtml =
      copies === 2
        ? `
        ${generateSlipHtml("CUSTOMER COPY")}
        <div class="tear-guide">
          <span>✂ - - - - - - - - - - TEAR / CUT HERE - - - - - - - - - - ✂</span>
        </div>
        ${generateSlipHtml("STORE / BAG COPY")}
      `
        : generateSlipHtml();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receipt — #${transaction.ticketId}</title>
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
      font-size: ${fontSize};
      line-height: 1.25;
      width: ${printableWidth};
      max-width: ${printableWidth};
      margin: 0 auto;
      padding: ${bodyPadding};
    }
    .receipt-slip {
      width: 100%;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .shop-logo {
      display: block;
      margin: 0 auto 3px auto;
      max-width: ${is58 ? "45px" : "55px"};
      max-height: ${is58 ? "45px" : "55px"};
      object-fit: contain;
      filter: grayscale(100%) contrast(150%);
    }
    .shop-name {
      font-size: ${shopNameSize};
      letter-spacing: -0.2px;
      margin-bottom: 2px;
    }
    .shop-sub {
      font-size: 10px;
      line-height: 1.2;
    }
    .ticket-id {
      font-size: ${ticketIdSize};
      margin: 3px 0;
      letter-spacing: 0.5px;
    }
    .copy-tag {
      font-size: 11px;
      letter-spacing: 1px;
      padding: 2px 0;
    }
    .divider-solid {
      border-top: 1px solid #000000;
      margin: 4px 0;
    }
    .divider-dashed {
      border-top: 1px dashed #000000;
      margin: 4px 0;
    }
    .divider-double {
      border-top: 2px dashed #000000;
      margin: 5px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 2px 0;
      gap: 4px;
    }
    .label {
      flex: 1;
      text-align: left;
    }
    .value {
      flex: 1.4;
      text-align: right;
      word-break: break-word;
    }
    .row-total {
      font-size: ${totalSize};
      margin: 4px 0;
    }
    .instruction-box {
      margin: 3px 0;
      font-size: 10px;
    }
    .instruction-text {
      display: block;
      font-style: italic;
      padding-left: 6px;
    }
    .payment-block {
      margin: 5px 0;
    }
    .payment-paid {
      font-size: 13px;
      font-weight: bold;
      border: 1.5px solid #000000;
      padding: 3px 4px;
      letter-spacing: 0.5px;
      display: inline-block;
    }
    .payment-unpaid {
      font-size: 12px;
      font-weight: bold;
      border: 1.5px solid #000000;
      padding: 3px 4px;
      display: inline-block;
    }
    .balance-line {
      font-size: 11px;
      margin-top: 2px;
    }
    .qr-section {
      margin: 6px 0;
    }
    .qr-code-img {
      display: block;
      margin: 0 auto;
      width: ${qrSize};
      height: ${qrSize};
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    .qr-caption {
      font-size: 9.5px;
      margin-top: 3px;
      line-height: 1.2;
    }
    .footer-text {
      font-size: 11px;
      margin-top: 3px;
    }
    .footer-sub {
      font-size: 9.5px;
      margin-top: 2px;
      line-height: 1.2;
    }
    .small-end-note {
      font-size: 8px;
      margin-top: 5px;
    }
    .tear-guide {
      text-align: center;
      font-size: 9px;
      margin: 10mm 0;
      padding: 3px 0;
      border-top: 1px dashed #000000;
      border-bottom: 1px dashed #000000;
    }
    .cutter-clearance {
      height: 22mm;
      width: 100%;
    }
    @media screen {
      body {
        margin: 20px auto;
        border: 1px solid #ccc;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
    }
  </style>
</head>
<body>
  ${slipsHtml}
  <!-- Blank clearance feed for thermal auto-cutter -->
  <div class="cutter-clearance"></div>
</body>
</html>`;
  };

  // Hidden Iframe Printing (Industry standard for POS: zero popups, instant, exact thermal dimensions)
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const html = generatePrintableHtml();

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
      if (!doc) {
        throw new Error("Unable to access print frame document");
      }

      doc.open();
      doc.write(html);
      doc.close();

      // Wait for any images (logo or QR code) to finish loading before invoking print
      const images = Array.from(doc.images);
      if (images.length > 0) {
        await Promise.all(
          images.map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete) {
                  resolve();
                } else {
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                  setTimeout(resolve, 1500);
                }
              })
          )
        );
      }

      // Allow DOM repaint, then trigger print
      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch (e) {
          console.error("Iframe print error, falling back to window print", e);
          fallbackPrintWindow(html);
        } finally {
          setIsPrinting(false);
        }
      }, 200);
    } catch (err) {
      console.error("Print failed:", err);
      fallbackPrintWindow(generatePrintableHtml());
      setIsPrinting(false);
    }
  };

  const fallbackPrintWindow = (html: string) => {
    const win = window.open("", "_blank", "width=420,height=750");
    if (!win) {
      alert("Please allow popups for this site so the receipt can be printed.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 350);
  };

  const handleDownloadReceipt = async () => {
    if (!transaction) return;
    setIsDownloadingPdf(true);
    try {
      const { downloadReceiptPdf } = await import("@/components/receipt-pdf");
      await downloadReceiptPdf(transaction, profile);
    } catch (err) {
      console.error("Failed to download PDF receipt:", err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const is58 = paperWidth === "58mm";
  const previewWidthPx = is58 ? 210 : 290;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-5 py-3.5 border-b bg-background shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>{postCreate ? "Order Created Successfully!" : "Print & Share Receipt"}</span>
                  <span className="text-xs font-mono font-normal bg-muted px-2 py-0.5 rounded text-foreground border">
                    #{transaction.ticketId}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {postCreate
                    ? "Order recorded. Review the receipt preview below and send it to your thermal printer."
                    : `Thermal receipt & tracking slips for #${transaction.ticketId} — ${transaction.customerName}`}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body: 2-Column Split on Desktop, Stacked on Mobile */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
          {/* Left: Thermal Receipt Preview Column */}
          <div className="md:col-span-6 lg:col-span-6 bg-neutral-100 dark:bg-neutral-950 p-4 flex flex-col items-center justify-start border-b md:border-b-0 md:border-r overflow-y-auto max-h-[46vh] md:max-h-[calc(92vh-75px)]">
            <div className="w-full flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-2 px-1 max-w-[320px]">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Receipt className="w-3.5 h-3.5 text-primary" /> Live Thermal Slip
              </span>
              <span className="font-mono text-[10px] bg-background px-1.5 py-0.5 rounded border">
                {paperWidth} • {copies === 1 ? "1 Copy" : "2 Copies"}
              </span>
            </div>

            <div
              ref={receiptPreviewRef}
              style={{
                width: `${previewWidthPx}px`,
                fontFamily: "'Courier New', Courier, 'Lucida Console', Monaco, monospace",
              }}
              className="bg-white text-black p-3.5 rounded shadow-md text-xs leading-tight transition-all duration-200 select-none border border-neutral-300"
            >
              {/* Store Header */}
              {showLogo && profile.logoDataUrl && (
                <div className="text-center mb-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profile.logoDataUrl}
                    alt="Shop logo"
                    className="mx-auto block object-contain max-h-12 grayscale contrast-125"
                  />
                </div>
              )}
              {profile.shopName && (
                <div className={`text-center font-bold tracking-tight ${is58 ? "text-xs" : "text-sm"} mb-0.5`}>
                  {profile.shopName}
                </div>
              )}
              {profile.tagline && (
                <div className="text-center text-[10px] text-neutral-800 leading-snug">{profile.tagline}</div>
              )}
              {profile.address && (
                <div className="text-center text-[10px] text-neutral-800 leading-snug">{profile.address}</div>
              )}
              {profile.contactNumber && (
                <div className="text-center text-[10px] text-neutral-800 leading-snug">Tel: {profile.contactNumber}</div>
              )}
              {profile.email && (
                <div className="text-center text-[10px] text-neutral-800 leading-snug">{profile.email}</div>
              )}

              <div className="border-t-2 border-dashed border-black my-2" />

              {/* Ticket ID & Time */}
              <div className={`text-center font-bold tracking-wider ${is58 ? "text-sm" : "text-base"} my-1`}>
                #{transaction.ticketId}
              </div>
              <div className="flex justify-between text-[11px] my-0.5">
                <span className="text-neutral-700">Date/Time:</span>
                <span className="font-semibold">{transaction.arrivalDateTime}</span>
              </div>

              <div className="border-t border-dashed border-black my-1.5" />

              {/* Customer Details */}
              <div className="flex justify-between text-[11px] my-0.5">
                <span className="text-neutral-700">Customer:</span>
                <span className="font-bold">{transaction.customerName}</span>
              </div>
              <div className="flex justify-between text-[11px] my-0.5">
                <span className="text-neutral-700">Phone:</span>
                <span>{maskPhoneNumber(transaction.phone)}</span>
              </div>

              <div className="border-t border-dashed border-black my-1.5" />

              {/* Service & Items */}
              <div className="flex justify-between text-[11px] my-0.5">
                <span className="text-neutral-700">Service:</span>
                <span className="font-bold">{transaction.washType}</span>
              </div>
              <div className="flex justify-between text-[11px] my-0.5">
                <span className="text-neutral-700">{transaction.weight > 0 ? "Weight:" : "Load:"}</span>
                <span>{transaction.weight > 0 ? `${transaction.weight} kg` : "Per Load"}</span>
              </div>
              {transaction.addOns && transaction.addOns.length > 0 && (
                <div className="flex justify-between text-[11px] my-0.5">
                  <span className="text-neutral-700">Add-ons:</span>
                  <span className="text-right">{transaction.addOns.join(", ")}</span>
                </div>
              )}
              {transaction.washInstructions && (
                <div className="text-[10px] my-1 pt-0.5">
                  <span className="text-neutral-700">Note: </span>
                  <span className="italic">{transaction.washInstructions}</span>
                </div>
              )}

              <div className="border-t border-dashed border-black my-1.5" />

              {/* Fee Breakdown */}
              <div className="text-[10px] font-bold text-neutral-800 uppercase tracking-wider mb-1">Cost Breakdown</div>
              <div className="flex justify-between text-[11px] my-0.5">
                <span>{breakdown.serviceName}</span>
                <span>&#8369;{breakdown.serviceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {breakdown.serviceDetail && (
                <div className="text-[9.5px] text-neutral-500 pl-1 -mt-0.5 mb-1">
                  ({breakdown.serviceDetail})
                </div>
              )}
              {breakdown.addOns.map((addon) => (
                <div key={addon.name} className="flex justify-between text-[10px] text-neutral-700 my-0.5">
                  <span>+ Add-on: {addon.name}</span>
                  <span>&#8369;{addon.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="border-t border-black my-1" />
              <div className={`flex justify-between font-bold ${is58 ? "text-xs" : "text-sm"} my-1`}>
                <span>TOTAL AMOUNT:</span>
                <span>&#8369;{transaction.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div className="border-t-2 border-dashed border-black my-2" />

              {/* Payment Status (Solid Thermal Block) */}
              <div className="text-center my-2">
                {transaction.paymentStatus === "paid" ? (
                  <div className="border-2 border-black inline-block px-3 py-1 font-bold text-xs tracking-wider">
                    *** PAID IN FULL ***
                  </div>
                ) : (
                  <div className="border-2 border-black inline-block px-2.5 py-1 font-bold text-xs leading-tight">
                    <div>*** UNPAID ***</div>
                    <div className="text-[10px] font-semibold mt-0.5">
                      BALANCE DUE: &#8369;{transaction.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-black my-1.5" />

              {/* Status & ETA */}
              <div className="flex justify-between text-[11px] my-0.5">
                <span className="text-neutral-700">Status:</span>
                <span className="font-bold">{transaction.status}</span>
              </div>
              <div className="flex justify-between text-[11px] my-0.5">
                <span className="text-neutral-700">Est. Ready:</span>
                <span className="text-right">
                  {transaction.eta ? formatReadableDateTime(transaction.eta) : "Pending Schedule"}
                </span>
              </div>

              {/* QR Code */}
              {showQr && (
                <>
                  <div className="border-t border-dashed border-black my-1.5" />
                  <div className="text-center my-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrUrl}
                      alt={`QR for ${transaction.ticketId}`}
                      width={is58 ? 85 : 105}
                      height={is58 ? 85 : 105}
                      className="mx-auto block"
                      crossOrigin="anonymous"
                    />
                    <div className="text-[9px] text-neutral-800 mt-1">Scan with camera to track order</div>
                  </div>
                </>
              )}

              <div className="border-t border-dashed border-black my-1.5" />

              {/* Footer / Notes */}
              {profile.receiptFooter && (
                <div className="text-center font-bold text-[10px] mt-1">{profile.receiptFooter}</div>
              )}
              <div className="text-center text-[9px] text-neutral-700 mt-0.5">
                {profile.pickupInstructions || "Present this receipt or QR code upon claiming."}
              </div>

              {copies === 2 && (
                <div className="mt-4 pt-2 border-t-2 border-dotted border-neutral-400 text-center text-[9px] text-neutral-500">
                  ✂ - - - - - Tear Line (2nd Store Copy will print below) - - - - - ✂
                </div>
              )}

              <div className="text-center text-[8px] text-neutral-500 mt-2 pb-1">
                [ ~20mm Auto-Cutter Clearance Included ]
              </div>
            </div>
          </div>

          {/* Right: Print Options & Actions Column */}
          <div className="md:col-span-6 lg:col-span-6 p-4 md:p-5 flex flex-col justify-between overflow-y-auto max-h-[calc(92vh-75px)] bg-background">
            <div className="space-y-4">
              {/* 1. Print Settings */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-primary" /> Print Settings
                </div>

                {/* Paper Size Selector */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-foreground">Paper Width</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handlePaperWidthChange("80mm")}
                      className={`p-2.5 text-xs rounded-lg border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                        paperWidth === "80mm"
                          ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <span className="font-bold text-foreground">80mm (Standard)</span>
                      <span className="text-[10px] text-muted-foreground">Standard desktop thermal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaperWidthChange("58mm")}
                      className={`p-2.5 text-xs rounded-lg border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                        paperWidth === "58mm"
                          ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <span className="font-bold text-foreground">58mm (Compact)</span>
                      <span className="text-[10px] text-muted-foreground">Mini Bluetooth printer</span>
                    </button>
                  </div>
                </div>

                {/* Copies Selector */}
                <div className="mt-3 space-y-1.5">
                  <span className="text-xs font-semibold text-foreground">Number of Copies</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCopies(1)}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
                        copies === 1
                          ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      1 Copy (Customer)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCopies(2)}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
                        copies === 2
                          ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      2 Copies (Store + Customer)
                    </button>
                  </div>
                </div>

                {/* Inclusions */}
                <div className="mt-3.5 flex items-center gap-4 pt-2.5 border-t text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-foreground font-medium">
                    <input
                      type="checkbox"
                      checked={showQr}
                      onChange={(e) => setShowQr(e.target.checked)}
                      className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    <span>Include QR Code</span>
                  </label>
                  {profile.logoDataUrl && (
                    <label className="flex items-center gap-2 cursor-pointer select-none text-foreground font-medium">
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={(e) => setShowLogo(e.target.checked)}
                        className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                      <span>Include Shop Logo</span>
                    </label>
                  )}
                </div>
              </div>

              {/* 2. Standalone Claim Tag Box */}
              <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-2">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <QrCode className="w-3.5 h-3.5 text-primary" /> Standalone Claim Tag
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">Fast bag slip</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Need only a small claim tag with the tracking QR code for the laundry bag?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void printQrTicketOnly(transaction, profile, paperWidth)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs cursor-pointer font-semibold hover:bg-background shadow-xs bg-background"
                >
                  <Printer className="w-3.5 h-3.5 text-primary" />
                  Print QR Bag Tag Only ({paperWidth})
                </Button>
              </div>

              {/* 3. Export & Digital Downloads */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-primary" /> Digital Copies & Downloads
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadReceipt}
                    disabled={isDownloadingPdf}
                    className="flex items-center justify-center gap-1.5 text-xs cursor-pointer font-semibold hover:bg-background shadow-xs bg-background"
                  >
                    {isDownloadingPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5 text-primary" />
                    )}
                    Download PDF Receipt
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadQrCodeImage(transaction)}
                    className="flex items-center justify-center gap-1.5 text-xs cursor-pointer font-semibold hover:bg-background shadow-xs bg-background"
                  >
                    <QrCode className="w-3.5 h-3.5 text-primary" />
                    Download QR Image
                  </Button>
                </div>
              </div>
            </div>

            {/* Bottom Actions: Print & Close */}
            <div className="pt-4 border-t mt-4 space-y-2">
              <Button
                className="w-full h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer font-bold shadow-md text-sm"
                onClick={handlePrint}
                disabled={isPrinting}
              >
                {isPrinting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Preparing Thermal Print Job...
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" /> Print Thermal Receipt ({paperWidth})
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-3.5 h-3.5 mr-1" /> {postCreate ? "Done" : "Close"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
