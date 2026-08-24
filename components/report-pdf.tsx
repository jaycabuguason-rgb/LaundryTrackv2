"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { Transaction } from "@/lib/data";
import type { serviceRevenueData as SRDType } from "@/lib/data";

// ── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 0,
    paddingBottom: 32,
    paddingHorizontal: 0,
    color: "#111",
  },
  // Header band
  headerBand: {
    backgroundColor: "#1d4ed8",
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    marginBottom: 3,
  },
  headerMeta: {
    fontSize: 8,
    color: "#bfdbfe",
  },
  // Body
  body: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1d4ed8",
    marginBottom: 6,
    marginTop: 16,
    borderBottom: "1px solid #dbeafe",
    paddingBottom: 3,
  },
  // Table
  table: {
    width: "100%",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1d4ed8",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #e5e7eb",
  },
  tableRowEven: {
    flexDirection: "row",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f8fafc",
  },
  th: {
    color: "#fff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    padding: 5,
    flex: 1,
  },
  td: {
    fontSize: 8,
    padding: 4,
    flex: 1,
    color: "#111",
  },
  // Fixed-width columns
  colSm:  { flex: 0.7 },
  colMd:  { flex: 1 },
  colLg:  { flex: 1.4 },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const Table = ({
  headers,
  rows,
  flexes,
}: {
  headers: string[];
  rows: string[][];
  flexes?: number[];
}) => (
  <View style={S.table}>
    {/* Header */}
    <View style={S.tableHeaderRow}>
      {headers.map((h, i) => (
        <Text key={i} style={[S.th, flexes ? { flex: flexes[i] } : {}]}>{h}</Text>
      ))}
    </View>
    {/* Rows */}
    {rows.map((row, ri) => (
      <View key={ri} style={ri % 2 === 0 ? S.tableRow : S.tableRowEven}>
        {row.map((cell, ci) => (
          <Text key={ci} style={[S.td, flexes ? { flex: flexes[ci] } : {}]}>{cell}</Text>
        ))}
      </View>
    ))}
  </View>
);

// ── PDF Document ─────────────────────────────────────────────────────────────
export interface ReportPdfProps {
  exportFrom: string;
  exportTo: string;
  sections: ("transactions" | "analytics" | "customers")[];
  transactions: Transaction[];
  serviceRevenue: typeof SRDType;
}

function ReportDocument({ exportFrom, exportTo, sections, transactions, serviceRevenue }: ReportPdfProps) {
  // Build customer rows from transactions
  const seen = new Set<string>();
  const custRows: string[][] = [];
  transactions.forEach((t) => {
    if (!seen.has(t.phone)) {
      seen.add(t.phone);
      const ct = transactions.filter((x) => x.phone === t.phone);
      custRows.push([
        t.customerName,
        t.phone,
        String(ct.length),
        `₱${ct.reduce((s, x) => s + x.fee, 0)}`,
      ]);
    }
  });

  return (
    <Document title={`LaundryTrack_Report_${exportFrom}`}>
      {/* ── Page 1: Header + Transactions ── */}
      {sections.includes("transactions") && (
        <Page size="A4" style={S.page} orientation="landscape">
          <View style={S.headerBand}>
            <Text style={S.headerTitle}>LaundryTrack — Export Report</Text>
            <Text style={S.headerMeta}>
              Date range: {exportFrom} to {exportTo}{"   "}|{"   "}Generated: {new Date().toLocaleDateString()}
            </Text>
          </View>
          <View style={S.body}>
            <Text style={S.sectionTitle}>Transactions</Text>
            <Table
              headers={["Ticket ID", "Customer", "Phone", "Drop-off", "Type", "Weight", "Fee", "Status"]}
              rows={transactions.map((t) => [
                t.ticketId,
                t.customerName,
                t.phone,
                t.dropOffDate,
                t.washType,
                `${t.weight} kg`,
                `₱${t.fee}`,
                t.status,
              ])}
              flexes={[0.9, 1.4, 1.1, 0.9, 0.9, 0.7, 0.7, 0.9]}
            />
          </View>
        </Page>
      )}

      {/* ── Page 2: Analytics ── */}
      {sections.includes("analytics") && (
        <Page size="A4" style={S.page}>
          <View style={S.headerBand}>
            <Text style={S.headerTitle}>LaundryTrack — Export Report</Text>
            <Text style={S.headerMeta}>
              Date range: {exportFrom} to {exportTo}{"   "}|{"   "}Generated: {new Date().toLocaleDateString()}
            </Text>
          </View>
          <View style={S.body}>
            <Text style={S.sectionTitle}>Revenue by Service Type</Text>
            <Table
              headers={["Service", "Transactions", "Revenue (₱)", "Avg per Order (₱)"]}
              rows={serviceRevenue.map((r) => [
                r.service,
                String(r.count),
                `₱${r.revenue.toLocaleString()}`,
                `₱${Math.round(r.revenue / r.count)}`,
              ])}
            />
          </View>
        </Page>
      )}

      {/* ── Page 3: Customer List ── */}
      {sections.includes("customers") && (
        <Page size="A4" style={S.page}>
          <View style={S.headerBand}>
            <Text style={S.headerTitle}>LaundryTrack — Export Report</Text>
            <Text style={S.headerMeta}>
              Date range: {exportFrom} to {exportTo}{"   "}|{"   "}Generated: {new Date().toLocaleDateString()}
            </Text>
          </View>
          <View style={S.body}>
            <Text style={S.sectionTitle}>Customer List</Text>
            <Table
              headers={["Name", "Phone", "Total Transactions", "Total Spent (₱)"]}
              rows={custRows}
              flexes={[1.4, 1.1, 1, 1]}
            />
          </View>
        </Page>
      )}
    </Document>
  );
}

// ── Export the async download function ───────────────────────────────────────
export async function downloadReportPdf(props: ReportPdfProps) {
  const blob = await pdf(<ReportDocument {...props} />).toBlob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `LaundryTrack_Report_${props.exportFrom}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
