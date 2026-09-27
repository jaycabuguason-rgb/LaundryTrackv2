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
  totalRow: {
    flexDirection: "row",
    borderTop: "1.5px solid #1d4ed8",
    backgroundColor: "#eff6ff",
  },
  totalCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    padding: 5,
    flex: 1,
    color: "#1d4ed8",
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
function formatPhp(amount: number): string {
  return `PHP ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const Table = ({
  headers,
  rows,
  flexes,
  aligns,
  boldLastRow,
}: {
  headers: string[];
  rows: string[][];
  flexes?: number[];
  aligns?: Array<"left" | "center" | "right">;
  boldLastRow?: boolean;
}) => (
  <View style={S.table}>
    {/* Header */}
    <View style={S.tableHeaderRow}>
      {headers.map((h, i) => (
        <Text
          key={i}
          style={[
            S.th,
            flexes ? { flex: flexes[i] } : {},
            aligns && aligns[i] ? { textAlign: aligns[i] } : {},
          ]}
        >
          {h}
        </Text>
      ))}
    </View>
    {/* Rows */}
    {rows.map((row, ri) => {
      const isLast = Boolean(boldLastRow && ri === rows.length - 1);
      return (
        <View
          key={ri}
          style={
            isLast
              ? S.totalRow
              : ri % 2 === 0
              ? S.tableRow
              : S.tableRowEven
          }
        >
          {row.map((cell, ci) => (
            <Text
              key={ci}
              style={[
                isLast ? S.totalCell : S.td,
                flexes ? { flex: flexes[ci] } : {},
                aligns && aligns[ci] ? { textAlign: aligns[ci] } : {},
              ]}
            >
              {cell}
            </Text>
          ))}
        </View>
      );
    })}
  </View>
);

// ── PDF Document ─────────────────────────────────────────────────────────────
export interface ReportPdfProps {
  exportFrom: string;
  exportTo: string;
  shopName?: string;
  enablePaymentOption?: boolean;
  sections: ("transactions" | "analytics" | "customers")[];
  transactions: Transaction[];
  serviceRevenue: typeof SRDType;
  totalCollectedRevenue?: number;
  totalOutstandingBalance?: number;
  totalPaidOrders?: number;
  totalWeight?: number;
  averageOrderValue?: number;
  voidedCount?: number;
}

function ReportDocument({
  exportFrom,
  exportTo,
  shopName = "LaundryTrack",
  enablePaymentOption = true,
  sections,
  transactions,
  serviceRevenue,
  totalCollectedRevenue,
  totalOutstandingBalance,
  totalPaidOrders,
  totalWeight,
  averageOrderValue,
  voidedCount,
}: ReportPdfProps) {
  const displayName = shopName?.trim() || "LaundryTrack";

  // Derive metrics if not explicitly passed
  const nonVoidTxns = transactions.filter((t) => t.status !== "Voided");
  const voidCount = voidedCount ?? transactions.filter((t) => t.status === "Voided").length;
  const processedWeight = totalWeight ?? transactions.reduce((sum, t) => sum + (t.weight || 0), 0);

  const collectedRev =
    totalCollectedRevenue ??
    (enablePaymentOption
      ? transactions.filter((t) => t.paymentStatus === "paid" && t.status !== "Voided").reduce((sum, t) => sum + t.fee, 0)
      : nonVoidTxns.reduce((sum, t) => sum + t.fee, 0));

  const outstandingBal =
    totalOutstandingBalance ??
    (enablePaymentOption
      ? transactions.filter((t) => t.paymentStatus === "unpaid" && t.status !== "Voided").reduce((sum, t) => sum + t.fee, 0)
      : 0);

  const paidCount =
    totalPaidOrders ??
    (enablePaymentOption
      ? transactions.filter((t) => t.paymentStatus === "paid" && t.status !== "Voided").length
      : nonVoidTxns.length);

  const aov =
    averageOrderValue ??
    (paidCount > 0 ? Math.round(collectedRev / paidCount) : 0);

  // Build customer rows with grand totals
  const seen = new Set<string>();
  const rawCustRows: string[][] = [];
  let grandTotalSpent = 0;
  let grandTotalVisits = 0;

  transactions.forEach((t) => {
    const key = t.phone?.trim() || t.customerName.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      const ct = transactions.filter((x) =>
        t.phone?.trim()
          ? x.phone?.trim() === t.phone.trim()
          : x.customerName.trim().toLowerCase() === t.customerName.trim().toLowerCase()
      );
      const totalSpent = ct.reduce((s, x) => s + x.fee, 0);
      grandTotalSpent += totalSpent;
      grandTotalVisits += ct.length;
      rawCustRows.push([
        t.customerName || "Customer",
        t.phone || "-",
        String(ct.length),
        formatPhp(totalSpent),
      ]);
    }
  });

  const fullCustRows: string[][] = [
    ...rawCustRows,
    [
      `TOTAL (${rawCustRows.length} Customers)`,
      "—",
      `${grandTotalVisits} orders`,
      formatPhp(grandTotalSpent),
    ],
  ];

  // Transactions table rows with grand total
  const totalTxnWeight = transactions.reduce((s, t) => s + (t.weight || 0), 0);
  const totalTxnFee = transactions.reduce((s, t) => s + (t.fee || 0), 0);
  const fullTxnRows: string[][] = [
    ...transactions.map((t) => [
      t.ticketId,
      t.customerName,
      t.phone || "-",
      t.dropOffDate,
      t.washType,
      `${t.weight} kg`,
      formatPhp(t.fee),
      t.status,
    ]),
    [
      "TOTAL",
      `${transactions.length} orders`,
      "—",
      "—",
      "—",
      `${totalTxnWeight.toFixed(1)} kg`,
      formatPhp(totalTxnFee),
      "—",
    ],
  ];

  // Analytics table rows with grand total
  const totalAnalyticsCount = serviceRevenue.reduce((s, r) => s + r.count, 0);
  const totalAnalyticsRevenue = serviceRevenue.reduce((s, r) => s + r.revenue, 0);
  const overallAvg = totalAnalyticsCount > 0 ? Math.round(totalAnalyticsRevenue / totalAnalyticsCount) : 0;
  const fullAnalyticsRows: string[][] = [
    ...serviceRevenue.map((r) => [
      r.service,
      String(r.count),
      formatPhp(r.revenue),
      formatPhp(r.count > 0 ? Math.round(r.revenue / r.count) : 0),
    ]),
    [
      "TOTAL",
      `${totalAnalyticsCount} orders`,
      formatPhp(totalAnalyticsRevenue),
      formatPhp(overallAvg),
    ],
  ];

  return (
    <Document title={`${displayName.replace(/\s+/g, "_")}_Report_${exportFrom}`}>
      {/* ── Page 0: Executive Summary ── */}
      <Page size="A4" style={S.page}>
        <View style={S.headerBand}>
          <Text style={S.headerTitle}>{displayName} — Business Summary Report</Text>
          <Text style={S.headerMeta}>
            Date range: {exportFrom} to {exportTo}{"   "}|{"   "}Generated: {new Date().toLocaleDateString()}
          </Text>
        </View>
        <View style={S.body}>
          <Text style={S.sectionTitle}>Executive Performance Overview</Text>
          <View style={S.summaryGrid}>
            {enablePaymentOption ? (
              <>
                <View style={S.summaryCard}>
                  <Text style={S.summaryLabel}>Total Collected Revenue</Text>
                  <Text style={S.summaryValue}>{formatPhp(collectedRev)}</Text>
                  <Text style={S.summaryLabel}>From {paidCount} paid transactions</Text>
                </View>
                <View style={S.summaryCard}>
                  <Text style={S.summaryLabel}>Outstanding Receivables</Text>
                  <Text style={[S.summaryValue, outstandingBal > 0 ? { color: "#b91c1c" } : { color: "#166534" }]}>
                    {formatPhp(outstandingBal)}
                  </Text>
                  <Text style={S.summaryLabel}>Unpaid orders balance</Text>
                </View>
                <View style={S.summaryCard}>
                  <Text style={S.summaryLabel}>Total Orders Processed</Text>
                  <Text style={S.summaryValue}>{nonVoidTxns.length}</Text>
                  <Text style={S.summaryLabel}>{transactions.length} total tickets in range</Text>
                </View>
                <View style={S.summaryCard}>
                  <Text style={S.summaryLabel}>Average Order Value (AOV)</Text>
                  <Text style={S.summaryValue}>{formatPhp(aov)}</Text>
                  <Text style={S.summaryLabel}>Per paid transaction</Text>
                </View>
              </>
            ) : (
              <>
                <View style={S.summaryCard}>
                  <Text style={S.summaryLabel}>Total Revenue</Text>
                  <Text style={S.summaryValue}>{formatPhp(collectedRev)}</Text>
                  <Text style={S.summaryLabel}>All recorded sales</Text>
                </View>
                <View style={S.summaryCard}>
                  <Text style={S.summaryLabel}>Total Orders</Text>
                  <Text style={S.summaryValue}>{nonVoidTxns.length}</Text>
                  <Text style={S.summaryLabel}>Total transactions recorded</Text>
                </View>
                <View style={S.summaryCard}>
                  <Text style={S.summaryLabel}>Total Weight Processed</Text>
                  <Text style={S.summaryValue}>{processedWeight.toFixed(1)} kg</Text>
                  <Text style={S.summaryLabel}>Operational laundry volume</Text>
                </View>
                <View style={S.summaryCard}>
                  <Text style={S.summaryLabel}>Average Order Value (AOV)</Text>
                  <Text style={S.summaryValue}>{formatPhp(aov)}</Text>
                  <Text style={S.summaryLabel}>Average spend per order</Text>
                </View>
              </>
            )}
          </View>

          {enablePaymentOption && (
            <View style={S.insightBox}>
              <Text style={S.insightText}>
                Settlement Status: {formatPhp(collectedRev)} collected from {paidCount} order{paidCount === 1 ? "" : "s"}
                {outstandingBal > 0 ? ` · ${formatPhp(outstandingBal)} pending collection` : " · All orders settled"}
              </Text>
            </View>
          )}

          <Text style={S.sectionTitle}>Operational Summary</Text>
          <View style={S.summaryGrid}>
            <View style={S.summaryCard}>
              <Text style={S.summaryLabel}>Total Laundry Volume</Text>
              <Text style={S.summaryValue}>{processedWeight.toFixed(1)} kg</Text>
              <Text style={S.summaryLabel}>Across all service lines</Text>
            </View>
            <View style={S.summaryCard}>
              <Text style={S.summaryLabel}>Active Service Offerings</Text>
              <Text style={S.summaryValue}>{serviceRevenue.length}</Text>
              <Text style={S.summaryLabel}>Service categories utilized</Text>
            </View>
          </View>

          {voidCount > 0 && (
            <Text style={[S.td, { color: "#6b7280", marginTop: 4 }]}>
              * Note: {voidCount} voided order{voidCount > 1 ? "s" : ""} excluded from active revenue calculations.
            </Text>
          )}
        </View>
      </Page>

      {/* ── Page 1: Header + Transactions ── */}
      {sections.includes("transactions") && (
        <Page size="A4" style={S.page} orientation="landscape">
          <View style={S.headerBand}>
            <Text style={S.headerTitle}>{displayName} — Export Report</Text>
            <Text style={S.headerMeta}>
              Date range: {exportFrom} to {exportTo}{"   "}|{"   "}Generated: {new Date().toLocaleDateString()}
            </Text>
          </View>
          <View style={S.body}>
            <Text style={S.sectionTitle}>Transactions</Text>
            <Table
              headers={["Ticket ID", "Customer", "Phone", "Drop-off", "Type", "Weight", "Fee (PHP)", "Status"]}
              rows={fullTxnRows}
              flexes={[0.9, 1.4, 1.1, 0.9, 0.9, 0.7, 1.1, 0.9]}
              aligns={["left", "left", "left", "center", "left", "right", "right", "center"]}
              boldLastRow={transactions.length > 0}
            />
          </View>
        </Page>
      )}

      {/* ── Page 2: Analytics ── */}
      {sections.includes("analytics") && (
        <Page size="A4" style={S.page}>
          <View style={S.headerBand}>
            <Text style={S.headerTitle}>{displayName} — Export Report</Text>
            <Text style={S.headerMeta}>
              Date range: {exportFrom} to {exportTo}{"   "}|{"   "}Generated: {new Date().toLocaleDateString()}
            </Text>
          </View>
          <View style={S.body}>
            <Text style={S.sectionTitle}>Revenue by Service Type</Text>
            <Table
              headers={["Service", "Transactions", "Revenue (PHP)", "Avg per Order (PHP)"]}
              rows={fullAnalyticsRows}
              flexes={[1.4, 1, 1.2, 1.2]}
              aligns={["left", "center", "right", "right"]}
              boldLastRow={serviceRevenue.length > 0}
            />
          </View>
        </Page>
      )}

      {/* ── Page 3: Loyalty Customer Records ── */}
      {sections.includes("customers") && (
        <Page size="A4" style={S.page}>
          <View style={S.headerBand}>
            <Text style={S.headerTitle}>{displayName} — Export Report</Text>
            <Text style={S.headerMeta}>
              Date range: {exportFrom} to {exportTo}{"   "}|{"   "}Generated: {new Date().toLocaleDateString()}
            </Text>
          </View>
          <View style={S.body}>
            <Text style={S.sectionTitle}>Loyalty Customer Records</Text>
            <Table
              headers={["Customer Name", "Phone", "Total Transactions", "Total Spent (PHP)"]}
              rows={fullCustRows}
              flexes={[1.4, 1.1, 1.1, 1.3]}
              aligns={["left", "left", "center", "right"]}
              boldLastRow={rawCustRows.length > 0}
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
