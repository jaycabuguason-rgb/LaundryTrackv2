"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
} from "@react-pdf/renderer";
import type { Transaction } from "@/lib/data";
import type { BusinessProfile } from "@/lib/settings-store";
import { formatReadableDateTime } from "@/lib/date-format";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 18,
    paddingBottom: 24,
    paddingHorizontal: 16,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: {
    alignItems: "center",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    borderBottomStyle: "dashed",
    paddingBottom: 10,
  },
  shopLogo: {
    width: 48,
    height: 48,
    marginBottom: 4,
    objectFit: "contain",
  },
  shopName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: "#111827",
    marginBottom: 2,
    textAlign: "center",
  },
  shopSub: {
    fontSize: 8,
    color: "#4b5563",
    textAlign: "center",
    lineHeight: 1.3,
  },
  ticketBand: {
    alignItems: "center",
    marginVertical: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
  },
  ticketId: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    letterSpacing: 0.5,
    color: "#111827",
  },
  ticketDate: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 2,
  },
  section: {
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  label: {
    fontSize: 8.5,
    color: "#4b5563",
  },
  value: {
    fontSize: 8.5,
    color: "#111827",
  },
  boldValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  totalBand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  totalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#166534",
  },
  totalAmount: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: "#166534",
  },
  paymentBadge: {
    alignSelf: "flex-end",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  paidBadge: {
    backgroundColor: "#dcfce7",
  },
  unpaidBadge: {
    backgroundColor: "#fee2e2",
  },
  paidText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#15803d",
  },
  unpaidText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#b91c1c",
  },
  qrContainer: {
    alignItems: "center",
    marginVertical: 8,
    paddingTop: 4,
  },
  qrImage: {
    width: 95,
    height: 95,
    marginBottom: 4,
  },
  qrCaption: {
    fontSize: 7.5,
    color: "#4b5563",
    textAlign: "center",
  },
  footer: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderTopStyle: "dashed",
    alignItems: "center",
  },
  footerNote: {
    fontSize: 7.5,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 1.3,
  },
  systemWatermark: {
    fontSize: 6.5,
    color: "#9ca3af",
    marginTop: 4,
    textAlign: "center",
  },
});

interface ReceiptDocumentProps {
  transaction: Transaction;
  profile: BusinessProfile;
  qrUrl: string;
}

export function ReceiptDocument({ transaction, profile, qrUrl }: ReceiptDocumentProps) {
  const isPaid = transaction.paymentStatus === "paid";

  return (
    <Document title={`Receipt #${transaction.ticketId}`}>
      <Page size={[226.77, 560]} style={S.page}>
        {/* Header */}
        <View style={S.header}>
          {profile.logoDataUrl ? (
            <Image src={profile.logoDataUrl} style={S.shopLogo} />
          ) : null}
          <Text style={S.shopName}>{profile.shopName || "LaundryTrack"}</Text>
          {profile.tagline ? <Text style={S.shopSub}>{profile.tagline}</Text> : null}
          {profile.address ? <Text style={S.shopSub}>{profile.address}</Text> : null}
          {profile.contactNumber ? (
            <Text style={S.shopSub}>Tel: {profile.contactNumber}</Text>
          ) : null}
        </View>

        {/* Ticket Header */}
        <View style={S.ticketBand}>
          <Text style={S.ticketId}>#{transaction.ticketId}</Text>
          <Text style={S.ticketDate}>{transaction.arrivalDateTime}</Text>
        </View>

        {/* Customer Info */}
        <View style={S.section}>
          <View style={S.row}>
            <Text style={S.label}>Customer:</Text>
            <Text style={S.boldValue}>{transaction.customerName}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Contact:</Text>
            <Text style={S.value}>{transaction.phone || "—"}</Text>
          </View>
        </View>

        {/* Order Details */}
        <View style={S.section}>
          <View style={S.row}>
            <Text style={S.label}>Service:</Text>
            <Text style={S.boldValue}>{transaction.washType}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>{transaction.weight > 0 ? "Weight:" : "Load:"}</Text>
            <Text style={S.value}>
              {transaction.weight > 0 ? `${transaction.weight} kg` : "Per Load"}
            </Text>
          </View>
          {transaction.addOns && transaction.addOns.length > 0 ? (
            <View style={S.row}>
              <Text style={S.label}>Add-ons:</Text>
              <Text style={S.value}>{transaction.addOns.join(", ")}</Text>
            </View>
          ) : null}
          {transaction.washInstructions ? (
            <View style={S.row}>
              <Text style={S.label}>Special Notes:</Text>
              <Text style={S.value}>{transaction.washInstructions}</Text>
            </View>
          ) : null}
          <View style={S.row}>
            <Text style={S.label}>Status:</Text>
            <Text style={S.boldValue}>{transaction.status}</Text>
          </View>
          {transaction.eta ? (
            <View style={S.row}>
              <Text style={S.label}>Est. Ready:</Text>
              <Text style={S.value}>{formatReadableDateTime(transaction.eta)}</Text>
            </View>
          ) : null}
        </View>

        {/* Total & Payment */}
        <View style={S.totalBand}>
          <Text style={S.totalLabel}>TOTAL AMOUNT</Text>
          <Text style={S.totalAmount}>PHP {transaction.fee}</Text>
        </View>

        <View style={S.row}>
          <Text style={S.label}>Payment Status:</Text>
          <View style={[S.paymentBadge, isPaid ? S.paidBadge : S.unpaidBadge]}>
            <Text style={isPaid ? S.paidText : S.unpaidText}>
              {isPaid ? "PAID" : "UNPAID"}
            </Text>
          </View>
        </View>

        {/* Tracking QR Code */}
        <View style={S.qrContainer}>
          <Image src={qrUrl} style={S.qrImage} />
          <Text style={S.qrCaption}>Scan with camera to track order status</Text>
          <Text style={[S.qrCaption, { fontFamily: "Helvetica-Bold", marginTop: 2 }]}>
            Ticket #{transaction.ticketId}
          </Text>
        </View>

        {/* Footer */}
        <View style={S.footer}>
          {profile.receiptFooter ? (
            <Text style={[S.footerNote, { fontFamily: "Helvetica-Bold", marginBottom: 2 }]}>
              {profile.receiptFooter}
            </Text>
          ) : null}
          <Text style={S.footerNote}>
            {profile.pickupInstructions || "Present this receipt or QR code upon claiming."}
          </Text>
          <Text style={S.systemWatermark}>LaundryTrack POS System</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadReceiptPdf(transaction: Transaction, profile: BusinessProfile) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://laundrytrack.ph";
  const trackingPath = transaction.publicTrackingToken
    ? `/track/${transaction.publicTrackingToken}`
    : `/ticket/${transaction.ticketId}`;
  const trackingFullUrl = `${origin}${trackingPath}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=${encodeURIComponent(
    trackingFullUrl
  )}`;

  const blob = await pdf(
    <ReceiptDocument transaction={transaction} profile={profile} qrUrl={qrUrl} />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Receipt-${transaction.ticketId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
