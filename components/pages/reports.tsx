"use client";

import { useMemo, useState } from "react";
import {
  CalendarIcon,
  Clock,
  CloudRain,
  Download,
  FileText,
  Lightbulb,
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
  Line,
  LineChart,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Transaction } from "@/lib/data";
import { statusColors } from "@/lib/data";
import { cn } from "@/lib/utils";

type ExportSection = "transactions" | "analytics" | "customers";
type ForecastRange = "7d" | "30d" | "3m" | "6m" | "custom";

type ReportsPageProps = {
  transactions: Transaction[];
  shopName?: string;
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
const BUSY_BAR = "#1e3a8a";
const NORMAL_BAR = "#93c5fd";
const MUTED_BAR = "#cbd5e1";
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDERED_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FORECAST_HOURS = Array.from({ length: 16 }, (_, index) => index + 6);
const forecastRangeOptions: Array<{ value: ForecastRange; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "custom", label: "Custom range" },
];

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

function getDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function subMonthsLocal(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() - months);
  return next;
}

function getForecastRangeDates(range: ForecastRange, customFrom: Date, customTo: Date) {
  const today = getDateOnly(new Date());
  if (range === "custom") {
    const from = getDateOnly(customFrom);
    const to = getDateOnly(customTo);
    return from <= to ? { from, to } : { from: to, to: from };
  }

  if (range === "7d") return { from: subDays(today, 6), to: today };
  if (range === "30d") return { from: subDays(today, 29), to: today };
  if (range === "3m") return { from: subMonthsLocal(today, 3), to: today };
  return { from: subMonthsLocal(today, 6), to: today };
}

function getInclusiveDayCount(from: Date, to: Date) {
  return Math.max(1, Math.floor((getDateOnly(to).getTime() - getDateOnly(from).getTime()) / 86400000) + 1);
}

function getDayOccurrences(from: Date, to: Date) {
  const counts = new Map<string, number>(DAY_LABELS.map((label) => [label, 0]));
  for (let day = getDateOnly(from); day <= to; day = addDays(day, 1)) {
    const label = DAY_LABELS[day.getDay()];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

function getArrivalHour(transaction: Transaction) {
  const match = transaction.arrivalDateTime.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) return null;
  const hour = Number(match[1]);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour}${suffix}`;
}

function getWeekOfMonth(date: Date) {
  return Math.min(4, Math.floor((date.getDate() - 1) / 7) + 1);
}

function formatWindow(startHour: number, endHour: number) {
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
}

function getPeakWindows(hourData: Array<{ hour: number; count: number }>) {
  const max = Math.max(...hourData.map((item) => item.count), 0);
  if (max === 0) return { peak: "-", secondPeak: "-" };

  const threshold = Math.max(1, Math.ceil(max * 0.75));
  const peakHours = new Set(hourData.filter((item) => item.count >= threshold).map((item) => item.hour));
  const windows: Array<{ start: number; end: number; total: number }> = [];

  for (const item of hourData) {
    if (!peakHours.has(item.hour)) continue;
    const previous = windows[windows.length - 1];
    if (previous && previous.end + 1 === item.hour) {
      previous.end = item.hour;
      previous.total += item.count;
    } else {
      windows.push({ start: item.hour, end: item.hour, total: item.count });
    }
  }

  const ranked = windows.sort((a, b) => b.total - a.total);
  const fallback = [...hourData].sort((a, b) => b.count - a.count);
  const peak = ranked[0] ? formatWindow(ranked[0].start, ranked[0].end + 1) : formatWindow(fallback[0].hour, fallback[0].hour + 1);
  const secondPeak = ranked[1]
    ? formatWindow(ranked[1].start, ranked[1].end + 1)
    : fallback.find((item) => !ranked[0] || Math.abs(item.hour - ranked[0].start) > 1)?.hour;

  return {
    peak,
    secondPeak: typeof secondPeak === "number" ? formatWindow(secondPeak, secondPeak + 1) : secondPeak || "-",
  };
}

function buildForecastMetrics(transactions: Transaction[], from: Date, to: Date) {
  const fromKey = toDateKey(from);
  const toKey = toDateKey(to);
  const rangeTransactions = transactions.filter((transaction) => {
    const dateKey = getDateKey(transaction);
    return dateKey >= fromKey && dateKey <= toKey;
  });
  const totalDays = getInclusiveDayCount(from, to);
  const dayOccurrences = getDayOccurrences(from, to);
  const dayCounts = new Map<string, number>(DAY_LABELS.map((label) => [label, 0]));
  const hourCounts = new Map<number, number>(FORECAST_HOURS.map((hour) => [hour, 0]));
  const weekCounts = new Map<number, number>([1, 2, 3, 4].map((week) => [week, 0]));

  for (const transaction of rangeTransactions) {
    const transactionDate = parseDateKey(transaction.dropOffDate);
    const dayLabel = DAY_LABELS[transactionDate.getDay()];
    dayCounts.set(dayLabel, (dayCounts.get(dayLabel) ?? 0) + 1);
    weekCounts.set(getWeekOfMonth(transactionDate), (weekCounts.get(getWeekOfMonth(transactionDate)) ?? 0) + 1);

    const hour = getArrivalHour(transaction);
    if (hour !== null && hourCounts.has(hour)) {
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }
  }

  const busyDays = ORDERED_DAY_LABELS.map((label) => ({
    label,
    customers: Math.round((dayCounts.get(label) ?? 0) / Math.max(dayOccurrences.get(label) ?? 1, 1)),
    total: dayCounts.get(label) ?? 0,
  }));
  const rankedDays = [...busyDays].sort((a, b) => b.customers - a.customers || b.total - a.total);
  const slowestDays = [...busyDays].sort((a, b) => a.customers - b.customers || a.total - b.total);
  const busiestDay = rankedDays[0]?.label ?? "-";
  const slowestDay = slowestDays[0]?.label ?? "-";
  const busiestTotal = rankedDays[0]?.total ?? 0;
  const averageDayTotal = rangeTransactions.length / Math.max(ORDERED_DAY_LABELS.length, 1);
  const staffLift = averageDayTotal > 0 ? Math.round(((busiestTotal - averageDayTotal) / averageDayTotal) * 100) : 0;

  const busyHours = FORECAST_HOURS.map((hour) => ({
    hour,
    label: formatHour(hour),
    customers: Math.round((hourCounts.get(hour) ?? 0) / totalDays),
    count: hourCounts.get(hour) ?? 0,
  }));
  const { peak, secondPeak } = getPeakWindows(busyHours);

  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const monthDate = subMonthsLocal(new Date(to.getFullYear(), to.getMonth(), 1), 5 - index);
    const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    return { month, label: format(monthDate, "MMM"), transactions: 0 };
  });
  const monthMap = new Map(monthlyTrend.map((item) => [item.month, item]));
  for (const transaction of rangeTransactions) {
    const month = transaction.dropOffDate.slice(0, 7);
    const current = monthMap.get(month);
    if (current) current.transactions += 1;
  }
  const currentMonth = monthlyTrend[monthlyTrend.length - 1]?.transactions ?? 0;
  const previousMonth = monthlyTrend[monthlyTrend.length - 2]?.transactions ?? 0;
  const trendPercent = previousMonth > 0 ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100) : currentMonth > 0 ? 100 : 0;

  const rankedWeeks = [...weekCounts.entries()].sort((a, b) => b[1] - a[1]);
  const busiestWeek = rankedWeeks[0]?.[1] ? rankedWeeks[0][0] : 0;
  const insight = rangeTransactions.length === 0
    ? "There is not enough transaction history in this date range to produce a reliable forecast. Add more transactions or widen the date range to reveal customer patterns."
    : `Based on ${rangeTransactions.length} transactions from ${fromKey} to ${toKey}, your shop is busiest on ${busiestDay}, especially around ${peak}. ${busiestWeek ? `Week ${busiestWeek} of the month is currently the strongest staffing period. ` : ""}Consider adding coverage during these windows to keep drop-offs moving quickly.`;

  return {
    fromKey,
    toKey,
    rangeTransactions,
    busyDays,
    busyHours,
    monthlyTrend,
    busiestDay,
    slowestDay,
    peak,
    secondPeak,
    busiestWeek,
    staffLift,
    trendPercent,
    insight,
  };
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

export default function ReportsPage({ transactions, shopName = "LaundryTrack" }: ReportsPageProps) {
  const [summaryDate, setSummaryDate] = useState<Date>(new Date());
  const [exportFromDate, setExportFromDate] = useState<Date>(subDays(new Date(), 30));
  const [exportToDate, setExportToDate] = useState<Date>(new Date());
  const [forecastRange, setForecastRange] = useState<ForecastRange>("30d");
  const [forecastFromDate, setForecastFromDate] = useState<Date>(subDays(new Date(), 29));
  const [forecastToDate, setForecastToDate] = useState<Date>(new Date());
  const [selectedExports, setSelectedExports] = useState<ExportSection[]>(["transactions", "analytics"]);
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv">("pdf");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [forecastPdfGenerating, setForecastPdfGenerating] = useState(false);

  const summaryDateKey = format(summaryDate, "yyyy-MM-dd");
  const exportFrom = format(exportFromDate, "yyyy-MM-dd");
  const exportTo = format(exportToDate, "yyyy-MM-dd");
  const forecastDates = useMemo(
    () => getForecastRangeDates(forecastRange, forecastFromDate, forecastToDate),
    [forecastFromDate, forecastRange, forecastToDate],
  );
  const forecastMetrics = useMemo(
    () => buildForecastMetrics(transactions, forecastDates.from, forecastDates.to),
    [forecastDates.from, forecastDates.to, transactions],
  );

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

  const handleForecastPdfExport = async () => {
    if (forecastPdfGenerating) return;

    setForecastPdfGenerating(true);
    try {
      const { downloadForecastReportPdf } = await import("@/components/report-pdf");
      await downloadForecastReportPdf({
        shopName,
        exportFrom: forecastMetrics.fromKey,
        exportTo: forecastMetrics.toKey,
        metrics: {
          busyDays: forecastMetrics.busyDays,
          busyHours: forecastMetrics.busyHours,
          monthlyTrend: forecastMetrics.monthlyTrend,
          busiestDay: forecastMetrics.busiestDay,
          slowestDay: forecastMetrics.slowestDay,
          peak: forecastMetrics.peak,
          secondPeak: forecastMetrics.secondPeak,
          busiestWeek: forecastMetrics.busiestWeek,
          staffLift: forecastMetrics.staffLift,
          trendPercent: forecastMetrics.trendPercent,
          insight: forecastMetrics.insight,
          transactionCount: forecastMetrics.rangeTransactions.length,
        },
      });
    } finally {
      setForecastPdfGenerating(false);
    }
  };

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <div className="overflow-x-auto pb-0.5">
        <TabsList className="h-9 w-max min-w-full bg-muted/40">
          <TabsTrigger value="overview" className="text-xs">Daily Summary</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs">Sales Analytics</TabsTrigger>
          <TabsTrigger value="forecast" className="text-xs">Forecast</TabsTrigger>
          <TabsTrigger value="unclaimed" className="text-xs">Unclaimed Items</TabsTrigger>
          <TabsTrigger value="export" className="text-xs">Export</TabsTrigger>
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
            <div className="overflow-x-auto">
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
            <div className="overflow-x-auto">
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

      <TabsContent value="forecast" className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-none sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Customer Forecast</h3>
            <p className="text-xs text-muted-foreground">
              {forecastMetrics.rangeTransactions.length} transactions from {forecastMetrics.fromKey} to {forecastMetrics.toKey}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={forecastRange} onValueChange={(value) => setForecastRange(value as ForecastRange)}>
              <SelectTrigger className="h-9 w-full text-xs sm:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {forecastRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="h-9 gap-1.5 text-xs"
              disabled={forecastPdfGenerating}
              onClick={handleForecastPdfExport}
            >
              <FileText className="h-3.5 w-3.5" />
              {forecastPdfGenerating ? "Exporting..." : "Export Forecast Report"}
            </Button>
          </div>
        </div>

        {forecastRange === "custom" && (
          <Card className="border border-border shadow-none">
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-start gap-2 text-xs font-normal">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(forecastDates.from, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={forecastDates.from} onSelect={(date) => date && setForecastFromDate(date)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-start gap-2 text-xs font-normal">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(forecastDates.to, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={forecastDates.to} onSelect={(date) => date && setForecastToDate(date)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border border-border shadow-none">
            <CardContent className="p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarIcon className="h-3.5 w-3.5" />
                Best Day to Staff Up
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">{forecastMetrics.busiestDay}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {forecastMetrics.staffLift > 0 ? `Expect ${forecastMetrics.staffLift}% more customers` : "No lift detected yet"}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-none">
            <CardContent className="p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Peak Drop-off Time
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">{forecastMetrics.peak}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Highest volume window</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-none">
            <CardContent className="p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                Busiest Week
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {forecastMetrics.busiestWeek ? `Week ${forecastMetrics.busiestWeek}` : "-"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Strongest monthly pattern</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-none">
            <CardContent className="p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CloudRain className="h-3.5 w-3.5" />
                Weather Impact
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">Not connected</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Weather data unavailable</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Predicted Busy Days</CardTitle>
              <p className="text-xs text-muted-foreground">Based on historical transaction patterns</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastMetrics.busyDays}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value: number) => [value, "Predicted customers"]} />
                    <Bar dataKey="customers" radius={[6, 6, 0, 0]}>
                      {forecastMetrics.busyDays.map((entry) => (
                        <Cell key={entry.label} fill={entry.label === forecastMetrics.busiestDay ? BUSY_BAR : NORMAL_BAR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="rounded-md bg-muted/30 p-2.5">Busiest Day: <span className="font-semibold text-foreground">{forecastMetrics.busiestDay}</span></div>
                <div className="rounded-md bg-muted/30 p-2.5">Slowest Day: <span className="font-semibold text-foreground">{forecastMetrics.slowestDay}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Predicted Peak Hours</CardTitle>
              <p className="text-xs text-muted-foreground">When most customers drop off laundry</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastMetrics.busyHours} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="label" width={42} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value: number) => [value, "Predicted customers"]} />
                    <Bar dataKey="customers" radius={[0, 6, 6, 0]}>
                      {forecastMetrics.busyHours.map((entry) => (
                        <Cell key={entry.label} fill={forecastMetrics.peak.includes(entry.label) ? BUSY_BAR : MUTED_BAR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="rounded-md bg-muted/30 p-2.5">Peak Hours: <span className="font-semibold text-foreground">{forecastMetrics.peak}</span></div>
                <div className="rounded-md bg-muted/30 p-2.5">Second Peak: <span className="font-semibold text-foreground">{forecastMetrics.secondPeak}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Monthly Customer Trend</CardTitle>
            <p className="text-xs text-muted-foreground">Transaction volume over the past months</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastMetrics.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => [value, "Transactions"]} />
                  <Line type="monotone" dataKey="transactions" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 4, fill: "#1d4ed8" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className={cn("text-sm font-semibold", forecastMetrics.trendPercent >= 0 ? "text-green-600" : "text-red-600")}>
              {forecastMetrics.trendPercent >= 0 ? "Up" : "Down"} {Math.abs(forecastMetrics.trendPercent)}% vs last month
            </p>
          </CardContent>
        </Card>

        <Card className="border border-blue-100 bg-blue-50 shadow-none">
          <CardContent className="flex gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-950">Forecast insight</p>
              <p className="mt-1 text-sm leading-6 text-blue-900">{forecastMetrics.insight}</p>
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
            <div className="overflow-x-auto">
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
  );
}
