"use client";

import { useMemo, useState } from "react";
import {
  CalendarIcon,
  Download,
  FileText,
  PieChart as PieChartIcon,
  TrendingUp,
} from "lucide-react";
import { format, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Transaction } from "@/lib/data";
import { statusColors } from "@/lib/data";
import { cn } from "@/lib/utils";

type ExportSection = "transactions" | "analytics" | "customers";

type ReportsPageProps = {
  transactions: Transaction[];
};

type ServiceRevenueRow = {
  service: string;
  revenue: number;
  count: number;
};

const exportOptions: Array<{ id: ExportSection; label: string }> = [
  { id: "transactions", label: "Transactions" },
  { id: "analytics", label: "Sales and Analytics" },
  { id: "customers", label: "Customer Summary" },
];

const PIE_COLORS = ["#2563eb", "#0f766e", "#f59e0b", "#dc2626", "#7c3aed", "#475569"];

function formatCurrency(value: number) {
  return `₱${value.toLocaleString()}`;
}

function getHourLabel(transaction: Transaction) {
  const match = transaction.arrivalDateTime.match(/(\d{2}):(\d{2})/);
  if (!match) return "Unknown";
  const hour = Number(match[1]);
  if (Number.isNaN(hour)) return "Unknown";

  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour}${suffix}`;
}

function getDateKey(transaction: Transaction) {
  return transaction.dropOffDate;
}

function getCustomerSummaryRows(transactions: Transaction[]) {
  const customerMap = new Map<string, { name: string; phone: string; count: number; spent: number }>();

  for (const transaction of transactions) {
    const key = transaction.phone?.trim() || transaction.customerName.trim().toLowerCase();
    const current = customerMap.get(key) ?? {
      name: transaction.customerName,
      phone: transaction.phone || "-",
      count: 0,
      spent: 0,
    };

    current.count += 1;
    current.spent += transaction.fee;
    customerMap.set(key, current);
  }

  return [...customerMap.values()].sort((a, b) => b.spent - a.spent);
}

export default function ReportsPage({ transactions }: ReportsPageProps) {
  const [summaryDate, setSummaryDate] = useState<Date>(new Date());
  const [exportFromDate, setExportFromDate] = useState<Date>(subDays(new Date(), 30));
  const [exportToDate, setExportToDate] = useState<Date>(new Date());
  const [selectedExports, setSelectedExports] = useState<ExportSection[]>(["transactions", "analytics"]);
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv">("pdf");
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const summaryDateKey = format(summaryDate, "yyyy-MM-dd");
  const exportFrom = format(exportFromDate, "yyyy-MM-dd");
  const exportTo = format(exportToDate, "yyyy-MM-dd");

  const filteredTransactions = useMemo(
    () => transactions.filter((transaction) => {
      const dateKey = getDateKey(transaction);
      return dateKey >= exportFrom && dateKey <= exportTo;
    }),
    [exportFrom, exportTo, transactions],
  );

  const summaryCards = useMemo(() => {
    const readyCount = transactions.filter((transaction) => transaction.status === "Ready").length;
    const totalRevenue = transactions.reduce((sum, transaction) => sum + transaction.fee, 0);
    const totalWeight = transactions.reduce((sum, transaction) => sum + (transaction.weight || 0), 0);

    return [
      { label: "Total Transactions", value: transactions.length.toLocaleString(), sub: "Realtime" },
      { label: "Total Revenue", value: formatCurrency(totalRevenue), sub: "Realtime" },
      { label: "Total Weight", value: `${totalWeight.toFixed(1)} kg`, sub: "Processed" },
      { label: "Ready for Pickup", value: readyCount.toLocaleString(), sub: "Current queue" },
    ];
  }, [transactions]);

  const dailyTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.dropOffDate === summaryDateKey),
    [summaryDateKey, transactions],
  );

  const serviceRevenue = useMemo<ServiceRevenueRow[]>(() => {
    const serviceMap = new Map<string, ServiceRevenueRow>();
    for (const transaction of filteredTransactions) {
      const current = serviceMap.get(transaction.washType) ?? {
        service: transaction.washType,
        revenue: 0,
        count: 0,
      };
      current.revenue += transaction.fee;
      current.count += 1;
      serviceMap.set(transaction.washType, current);
    }
    return [...serviceMap.values()].sort((a, b) => b.revenue - a.revenue);
  }, [filteredTransactions]);

  const serviceMixData = useMemo(
    () => serviceRevenue.map((row) => ({ name: row.service, value: row.revenue, count: row.count })),
    [serviceRevenue],
  );

  const paymentMixData = useMemo(() => {
    const paidRevenue = filteredTransactions
      .filter((transaction) => transaction.paymentStatus === "paid")
      .reduce((sum, transaction) => sum + transaction.fee, 0);
    const unpaidRevenue = filteredTransactions
      .filter((transaction) => transaction.paymentStatus === "unpaid")
      .reduce((sum, transaction) => sum + transaction.fee, 0);

    return [
      { name: "Paid", value: paidRevenue },
      { name: "Unpaid", value: unpaidRevenue },
    ];
  }, [filteredTransactions]);

  const statusMixData = useMemo(() => {
    const statusMap = new Map<string, number>();
    for (const transaction of filteredTransactions) {
      statusMap.set(transaction.status, (statusMap.get(transaction.status) ?? 0) + 1);
    }
    return [...statusMap.entries()].map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const salesTrendData = useMemo(() => {
    const salesMap = new Map<string, { label: string; revenue: number; count: number }>();

    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = subDays(new Date(), offset);
      const key = format(day, "yyyy-MM-dd");
      salesMap.set(key, {
        label: format(day, "MMM d"),
        revenue: 0,
        count: 0,
      });
    }

    for (const transaction of transactions) {
      const key = transaction.dropOffDate;
      const existing = salesMap.get(key);
      if (!existing) continue;
      existing.revenue += transaction.fee;
      existing.count += 1;
    }

    return [...salesMap.values()];
  }, [transactions]);

  const peakHourData = useMemo(() => {
    const hourMap = new Map<string, number>();

    for (const transaction of filteredTransactions) {
      const label = getHourLabel(transaction);
      hourMap.set(label, (hourMap.get(label) ?? 0) + 1);
    }

    return [...hourMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredTransactions]);

  const unclaimedItems = useMemo(
    () => transactions.filter((transaction) => transaction.status === "Ready"),
    [transactions],
  );

  const customerRows = useMemo(() => getCustomerSummaryRows(filteredTransactions), [filteredTransactions]);

  const totalFilteredRevenue = filteredTransactions.reduce((sum, transaction) => sum + transaction.fee, 0);
  const totalFilteredTransactions = filteredTransactions.length;
  const averageOrderValue = totalFilteredTransactions > 0 ? totalFilteredRevenue / totalFilteredTransactions : 0;

  const toggleExport = (id: ExportSection) => {
    setSelectedExports((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const handleCsvExport = () => {
    const rows: string[][] = [];

    if (selectedExports.includes("transactions")) {
      rows.push(["Transactions"]);
      rows.push(["Ticket ID", "Customer", "Phone", "Date", "Service", "Fee", "Status", "Payment"]);
      for (const transaction of filteredTransactions) {
        rows.push([
          transaction.ticketId,
          transaction.customerName,
          transaction.phone || "-",
          transaction.dropOffDate,
          transaction.washType,
          String(transaction.fee),
          transaction.status,
          transaction.paymentStatus,
        ]);
      }
      rows.push([]);
    }

    if (selectedExports.includes("analytics")) {
      rows.push(["Sales and Analytics"]);
      rows.push(["Metric", "Value"]);
      rows.push(["Total Revenue", String(totalFilteredRevenue)]);
      rows.push(["Total Transactions", String(totalFilteredTransactions)]);
      rows.push(["Average Order Value", String(Math.round(averageOrderValue))]);
      for (const row of serviceRevenue) {
        rows.push([`Service: ${row.service}`, `${row.count} txns / ${row.revenue}`]);
      }
      rows.push([]);
    }

    if (selectedExports.includes("customers")) {
      rows.push(["Customers"]);
      rows.push(["Name", "Phone", "Transactions", "Spent"]);
      for (const customer of customerRows) {
        rows.push([customer.name, customer.phone, String(customer.count), String(customer.spent)]);
      }
    }

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laundrytrack-report-${exportFrom}-${exportTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePdfExport = async () => {
    if (pdfGenerating) return;

    setPdfGenerating(true);
    try {
      const { downloadReportPdf } = await import("@/components/report-pdf");
      await downloadReportPdf({
        exportFrom,
        exportTo,
        sections: selectedExports,
        transactions: filteredTransactions,
        serviceRevenue,
      });
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <div className="min-h-[60vh] space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Reports</h2>
        <p className="text-xs text-muted-foreground">{transactions.length} total transactions</p>
      </div>
      {transactions.length === 0 && (
        <Card className="border border-border shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No report data yet. Add transactions to populate analytics and export sections.
          </CardContent>
        </Card>
      )}
    <Tabs defaultValue="overview" className="space-y-4">
      <div>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/40 p-1 sm:flex sm:h-9">
          <TabsTrigger value="overview" className="min-h-[40px] text-xs sm:min-h-0">Daily Summary</TabsTrigger>
          <TabsTrigger value="analytics" className="min-h-[40px] text-xs sm:min-h-0">Sales Analytics</TabsTrigger>
          <TabsTrigger value="unclaimed" className="min-h-[40px] text-xs sm:min-h-0">Unclaimed Items</TabsTrigger>
          <TabsTrigger value="export" className="min-h-[40px] text-xs sm:min-h-0">Export</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <Card key={card.label} className="border border-border shadow-none">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{card.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold">
                Transactions - {format(summaryDate, "MMMM d, yyyy")}
              </CardTitle>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 gap-1.5 px-2.5 text-xs">
                    <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                    {format(summaryDate, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={summaryDate} onSelect={(date) => date && setSummaryDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border md:hidden">
              {dailyTransactions.map((transaction) => (
                <div key={transaction.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-primary">{transaction.ticketId}</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{transaction.customerName}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{transaction.arrivalDateTime}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", statusColors[transaction.status])}>
                      {transaction.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-2.5">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Service</p>
                      <p className="truncate text-xs font-medium text-foreground">{transaction.washType}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Weight</p>
                      <p className="text-xs font-medium text-foreground">{transaction.weight} kg</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Fee</p>
                      <p className="text-xs font-semibold text-foreground">{formatCurrency(transaction.fee)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {dailyTransactions.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No transactions found for this date.
                </div>
              )}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/40">
                    {["Ticket ID", "Customer", "Arrival", "Service", "Weight", "Fee", "Status"].map((header) => (
                      <th key={header} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs font-mono text-primary">{transaction.ticketId}</td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{transaction.customerName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{transaction.arrivalDateTime}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{transaction.washType}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{transaction.weight} kg</td>
                      <td className="px-4 py-3 text-xs font-semibold text-foreground">{formatCurrency(transaction.fee)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusColors[transaction.status])}>
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {dailyTransactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No transactions found for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="analytics" className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border border-border shadow-none">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Sales in Range</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(totalFilteredRevenue)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{exportFrom} to {exportTo}</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-none">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Orders in Range</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{totalFilteredTransactions}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Realtime transactions</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-none">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Average Order Value</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(Math.round(averageOrderValue))}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Per transaction</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-none">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Peak Claim Window</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{peakHourData[0]?.label ?? "-"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{peakHourData[0]?.count ?? 0} transactions</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <PieChartIcon className="h-4 w-4 text-primary" />
                Market and Sales Mix
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={serviceMixData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={45}>
                      {serviceMixData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top Service</p>
                <p className="mt-1 text-lg font-bold text-foreground">{serviceRevenue[0]?.service ?? "-"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {serviceRevenue[0] ? `${serviceRevenue[0].count} transactions · ${formatCurrency(serviceRevenue[0].revenue)}` : "No service data yet."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Payment Split</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMixData} dataKey="value" nameKey="name" outerRadius={78}>
                      <Cell fill="#16a34a" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusMixData} dataKey="value" nameKey="name" outerRadius={78}>
                      {statusMixData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Peak Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {peakHourData.map((entry, index) => (
                <div key={entry.label} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Peak Window #{index + 1}</p>
                      <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">{entry.count}</p>
                      <p className="text-xs text-muted-foreground">orders</p>
                    </div>
                  </div>
                </div>
              ))}
              {peakHourData.length === 0 && (
                <p className="text-sm text-muted-foreground">No peak data available yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Service Revenue Table
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border md:hidden">
              {serviceRevenue.map((row) => (
                <div key={row.service} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{row.service}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.count} transactions</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-foreground">{formatCurrency(row.revenue)}</p>
                  </div>
                  <div className="rounded-md bg-muted/30 p-2.5">
                    <p className="text-[10px] text-muted-foreground">Average per order</p>
                    <p className="mt-0.5 text-xs font-medium text-foreground">
                      {formatCurrency(Math.round(row.revenue / Math.max(row.count, 1)))}
                    </p>
                  </div>
                </div>
              ))}
              {serviceRevenue.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No analytics data available for the selected range.
                </div>
              )}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/40">
                    {["Service", "Transactions", "Revenue", "Average per Order"].map((header) => (
                      <th key={header} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {serviceRevenue.map((row) => (
                    <tr key={row.service} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{row.service}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{row.count}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-foreground">{formatCurrency(row.revenue)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatCurrency(Math.round(row.revenue / Math.max(row.count, 1)))}
                      </td>
                    </tr>
                  ))}
                  {serviceRevenue.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No analytics data available for the selected range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="unclaimed">
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Ready but Unclaimed Items ({unclaimedItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border md:hidden">
              {unclaimedItems.map((transaction) => (
                <div key={transaction.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-primary">{transaction.ticketId}</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{transaction.customerName}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{transaction.phone || "-"}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                        transaction.paymentStatus === "paid" ? "bg-green-500 text-white" : "bg-red-500 text-white",
                      )}
                    >
                      {transaction.paymentStatus}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-2.5">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Arrival</p>
                      <p className="truncate text-xs font-medium text-foreground">{transaction.arrivalDateTime}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Service</p>
                      <p className="truncate text-xs font-medium text-foreground">{transaction.washType}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Fee</p>
                      <p className="text-xs font-semibold text-foreground">{formatCurrency(transaction.fee)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {unclaimedItems.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No ready-for-pickup items at the moment.
                </div>
              )}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/40">
                    {["Ticket ID", "Customer", "Phone", "Arrival", "Service", "Fee", "Payment"].map((header) => (
                      <th key={header} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unclaimedItems.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs font-mono text-primary">{transaction.ticketId}</td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{transaction.customerName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{transaction.phone || "-"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{transaction.arrivalDateTime}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{transaction.washType}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-foreground">{formatCurrency(transaction.fee)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                            transaction.paymentStatus === "paid" ? "bg-green-500 text-white" : "bg-red-500 text-white",
                          )}
                        >
                          {transaction.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {unclaimedItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No ready-for-pickup items at the moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="export">
        <Card className="max-w-2xl border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Export Live Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Select report sections</p>
              <div className="rounded-xl border border-border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {exportOptions.map((option) => (
                    <label key={option.id} className="flex cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={selectedExports.includes(option.id)}
                        onCheckedChange={() => toggleExport(option.id)}
                      />
                      <span className="text-xs text-foreground">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-start gap-2 text-xs font-normal">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(exportFromDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={exportFromDate} onSelect={(date) => date && setExportFromDate(date)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-start gap-2 text-xs font-normal">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(exportToDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={exportToDate} onSelect={(date) => date && setExportToDate(date)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Format</p>
              <div className="flex gap-4">
                {(["pdf", "csv"] as const).map((formatOption) => (
                  <label key={formatOption} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="report-format"
                      value={formatOption}
                      checked={exportFormat === formatOption}
                      onChange={() => setExportFormat(formatOption)}
                      className="accent-primary"
                    />
                    <span className="text-xs font-medium uppercase text-foreground">{formatOption}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
              This export uses your current live transactions, sales analytics, and customer summary for the selected date range.
            </div>

            <Button
              className="flex w-full items-center gap-1.5"
              disabled={selectedExports.length === 0 || pdfGenerating}
              onClick={exportFormat === "pdf" ? handlePdfExport : handleCsvExport}
            >
              {exportFormat === "pdf" ? <FileText className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              {pdfGenerating ? "Generating PDF..." : `Download ${exportFormat.toUpperCase()}`}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
    </div>
  );
}
