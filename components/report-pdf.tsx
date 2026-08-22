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
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  summaryCard: {
    width: "48%",
    border: "1px solid #dbeafe",
    padding: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 8,
    color: "#475569",
    marginBottom: 3,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1d4ed8",
  },
  insightBox: {
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    padding: 10,
    marginTop: 8,
  },
  insightText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: "#1e3a8a",
  },
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

export interface ForecastPdfMetrics {
  busyDays: Array<{ label: string; customers: number; total: number }>;
  busyHours: Array<{ label: string; customers: number; count: number }>;
  monthlyTrend: Array<{ label: string; transactions: number }>;
  busiestDay: string;
  slowestDay: string;
  peak: string;
  secondPeak: string;
  busiestWeek: number;
  staffLift: number;
  trendPercent: number;
  insight: string;
  transactionCount: number;
}

export interface ForecastReportPdfProps {
  shopName: string;
  exportFrom: string;
  exportTo: string;
  metrics: ForecastPdfMetrics;
}

function ForecastReportDocument({ shopName, exportFrom, exportTo, metrics }: ForecastReportPdfProps) {
  return (
    <Document title={`LaundryTrack_Forecast_Report_${exportFrom}`}>
      <Page size="A4" style={S.page}>
        <View style={S.headerBand}>
          <Text style={S.headerTitle}>LaundryTrack Forecast Report</Text>
          <Text style={S.headerMeta}>
            Shop: {shopName}{"   "}|{"   "}Date range: {exportFrom} to {exportTo}{"   "}|{"   "}Generated: {new Date().toLocaleDateString()}
          </Text>
        </View>
        <View style={S.body}>
          <Text style={S.sectionTitle}>Forecast Summary</Text>
          <View style={S.summaryGrid}>
            <View style={S.summaryCard}>
              <Text style={S.summaryLabel}>Best Day to Staff Up</Text>
              <Text style={S.summaryValue}>{metrics.busiestDay}</Text>
              <Text style={S.summaryLabel}>{metrics.staffLift > 0 ? `Expect ${metrics.staffLift}% more customers` : "No lift detected yet"}</Text>
            </View>
            <View style={S.summaryCard}>
              <Text style={S.summaryLabel}>Peak Drop-off Time</Text>
              <Text style={S.summaryValue}>{metrics.peak}</Text>
              <Text style={S.summaryLabel}>Highest volume window</Text>
            </View>
            <View style={S.summaryCard}>
              <Text style={S.summaryLabel}>Busiest Week</Text>
              <Text style={S.summaryValue}>{metrics.busiestWeek ? `Week ${metrics.busiestWeek}` : "-"}</Text>
              <Text style={S.summaryLabel}>Strongest monthly pattern</Text>
            </View>
            <View style={S.summaryCard}>
              <Text style={S.summaryLabel}>Weather Impact</Text>
              <Text style={S.summaryValue}>Not connected</Text>
              <Text style={S.summaryLabel}>Weather data unavailable</Text>
            </View>
          </View>

          <Text style={S.sectionTitle}>Predicted Busy Days</Text>
          <Table
            headers={["Day", "Predicted Customers", "Total Transactions"]}
            rows={metrics.busyDays.map((row) => [row.label, String(row.customers), String(row.total)])}
            flexes={[1, 1.2, 1.2]}
          />

          <Text style={S.sectionTitle}>Predicted Peak Hours</Text>
          <Table
            headers={["Hour", "Predicted Customers", "Total Transactions"]}
            rows={metrics.busyHours.map((row) => [row.label, String(row.customers), String(row.count)])}
            flexes={[1, 1.2, 1.2]}
          />
        </View>
      </Page>

      <Page size="A4" style={S.page}>
        <View style={S.headerBand}>
          <Text style={S.headerTitle}>LaundryTrack Forecast Report</Text>
          <Text style={S.headerMeta}>
            Shop: {shopName}{"   "}|{"   "}Date range: {exportFrom} to {exportTo}
          </Text>
        </View>
        <View style={S.body}>
          <Text style={S.sectionTitle}>Monthly Customer Trend</Text>
          <Table
            headers={["Month", "Transactions"]}
            rows={metrics.monthlyTrend.map((row) => [row.label, String(row.transactions)])}
          />
          <Text style={S.sectionTitle}>Trend Direction</Text>
          <Text style={S.td}>
            {metrics.trendPercent >= 0 ? "Increase" : "Decrease"} of {Math.abs(metrics.trendPercent)}% vs last month, based on {metrics.transactionCount} transactions in range.
          </Text>
          <Text style={S.sectionTitle}>Forecast Insight</Text>
          <View style={S.insightBox}>
            <Text style={S.insightText}>{metrics.insight}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadForecastReportPdf(props: ForecastReportPdfProps) {
  const blob = await pdf(<ForecastReportDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `LaundryTrack_Forecast_Report_${props.exportFrom}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
