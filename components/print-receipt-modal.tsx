"use client";

import { useRef, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { type Transaction } from "@/lib/data";
import { formatReadableDateTime } from "@/lib/date-format";
import { loadBusinessProfile, type BusinessProfile } from "@/lib/settings-store";

interface PrintReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  /** If true, shows "Transaction created!" header for the post-confirm flow */
  postCreate?: boolean;
}

export function PrintReceiptModal({ open, onOpenChange, transaction, postCreate }: PrintReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<BusinessProfile>(() => loadBusinessProfile());

  // Reload business profile every time the modal opens so changes reflect immediately
  useEffect(() => {
    if (open) {
      setProfile(loadBusinessProfile());
    }
  }, [open]);

  if (!transaction) return null;

  const addOnsTotal = 0; // Add-ons pricing not tracked per-item; fee already includes them
  const baseFee = transaction.fee;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://laundrytrack.ph";
  const trackingPath = transaction.publicTrackingToken
    ? `/track/${transaction.publicTrackingToken}`
    : `/ticket/${transaction.ticketId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${origin}${trackingPath}`)}`;

  const handlePrint = () => {
    const content = receiptRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank", "width=400,height=700");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt — ${transaction.ticketId}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; background: #fff; padding: 16px; width: 300px; }
            .receipt { width: 100%; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .large { font-size: 18px; }
            .xlarge { font-size: 22px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .label { color: #444; }
            .badge-paid { border: 2px solid #16a34a; color: #16a34a; padding: 2px 8px; border-radius: 4px; font-weight: bold; display: inline-block; }
            .badge-unpaid { border: 2px solid #dc2626; color: #dc2626; padding: 2px 8px; border-radius: 4px; font-weight: bold; display: inline-block; }
            .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 4px; }
            img { display: block; margin: 0 auto; }
            .small { font-size: 10px; color: #555; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${content}
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {postCreate ? "Transaction Created!" : "Print Receipt"}
          </DialogTitle>
          <DialogDescription>
            {postCreate
              ? "Transaction recorded successfully. Would you like to print the receipt?"
              : `Receipt for ${transaction.ticketId} — ${transaction.customerName}`}
          </DialogDescription>
        </DialogHeader>

        {/* Preview of the receipt */}
        <div className="border border-border rounded-lg p-4 bg-white overflow-hidden">
          <div ref={receiptRef} className="receipt font-mono text-xs text-black space-y-0" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
            {/* Header */}
            {profile.logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <div className="center" style={{ marginBottom: 4 }}>
                <img src={profile.logoDataUrl} alt="Shop logo" width={56} height={56} style={{ display: "block", margin: "0 auto", objectFit: "contain" }} />
              </div>
            )}
            {profile.shopName && (
              <div className="center bold text-sm mb-0.5">{profile.shopName}</div>
            )}
            {profile.tagline && (
              <div className="center text-[10px] text-gray-500 mb-0.5">{profile.tagline}</div>
            )}
            {profile.address && (
              <div className="center text-[10px] text-gray-500 mb-0.5">{profile.address}</div>
            )}
            {profile.contactNumber && (
              <div className="center text-[10px] text-gray-500 mb-0.5">{profile.contactNumber}</div>
            )}
            {profile.email && (
              <div className="center text-[10px] text-gray-500 mb-1">{profile.email}</div>
            )}
            <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            {/* Ticket ID */}
            <div className="center bold" style={{ fontSize: 20, margin: "6px 0" }}>{transaction.ticketId}</div>
            <div className="center text-[10px] text-gray-500 mb-1">{transaction.arrivalDateTime}</div>
            <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            {/* Customer Info */}
            <div className="row" style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
              <span className="label" style={{ color: "#555" }}>Customer</span>
              <span className="bold">{transaction.customerName}</span>
            </div>
            <div className="row" style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
              <span className="label" style={{ color: "#555" }}>Phone</span>
              <span>{transaction.phone || "—"}</span>
            </div>
            <div className="row" style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
              <span className="label" style={{ color: "#555" }}>Wash Type</span>
              <span>{transaction.washType}</span>
            </div>
            <div className="row" style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
              <span className="label" style={{ color: "#555" }}>{transaction.weight > 0 ? "Weight" : "Load Size"}</span>
              <span>{transaction.weight > 0 ? `${transaction.weight} kg` : "Per Load"}</span>
            </div>
            {transaction.addOns.length > 0 && (
              <div className="row" style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                <span className="label" style={{ color: "#555" }}>Add-ons</span>
                <span>{transaction.addOns.join(", ")}</span>
              </div>
            )}
            {transaction.washInstructions && (
              <div style={{ margin: "4px 0" }}>
                <div className="label" style={{ color: "#555" }}>Instructions:</div>
                <div style={{ fontStyle: "italic" }}>{transaction.washInstructions}</div>
              </div>
            )}
            <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            {/* Fee Breakdown */}
            <div className="row" style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
              <span className="label" style={{ color: "#555" }}>Base Fee</span>
              <span>&#8369;{baseFee.toLocaleString()}</span>
            </div>
            <div className="divider" style={{ borderTop: "1px solid #000", margin: "4px 0" }} />
            <div className="total-row" style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: "bold", margin: "4px 0" }}>
              <span>TOTAL</span>
              <span>&#8369;{transaction.fee.toLocaleString()}</span>
            </div>

            {/* Payment Status */}
            <div style={{ margin: "6px 0" }} className="center">
              {transaction.paymentStatus === "paid" ? (
                <span style={{ border: "2px solid #16a34a", color: "#16a34a", padding: "2px 10px", borderRadius: 4, fontWeight: "bold", fontSize: 13 }}>
                  PAID
                </span>
              ) : (
                <span style={{ border: "2px solid #dc2626", color: "#dc2626", padding: "2px 10px", borderRadius: 4, fontWeight: "bold", fontSize: 13 }}>
                  UNPAID — Balance Due: &#8369;{transaction.fee.toLocaleString()}
                </span>
              )}
            </div>
            <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            {/* Status & ETA */}
            <div className="row" style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
              <span className="label" style={{ color: "#555" }}>Status</span>
              <span className="bold">{transaction.status}</span>
            </div>
            <div className="row" style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
              <span className="label" style={{ color: "#555" }}>ETA</span>
              <span>{transaction.eta ? formatReadableDateTime(transaction.eta) : "Awaiting estimate"}</span>
            </div>
            <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            {/* QR Code */}
            <div className="center" style={{ margin: "8px 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt={`QR for ${transaction.ticketId}`} width={100} height={100} crossOrigin="anonymous" />
              <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Scan to track your laundry status</div>
            </div>
            <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            {/* Footer */}
            {profile.receiptFooter && (
              <div className="center bold" style={{ margin: "4px 0" }}>{profile.receiptFooter}</div>
            )}
            <div className="center small" style={{ fontSize: 10, color: "#555" }}>Present this receipt or QR code upon claiming.</div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button className="flex-1 gap-1.5" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Print Receipt
          </Button>
          <Button variant="outline" className="flex-1 gap-1.5" onClick={() => onOpenChange(false)}>
            <X className="w-3.5 h-3.5" /> {postCreate ? "Skip" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
