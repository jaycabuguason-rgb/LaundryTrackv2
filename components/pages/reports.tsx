"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarIcon,
  Clock,
  CloudRain,
  Download,
  FileText,
  Inbox,
  Lightbulb,
  PackageCheck,
  PieChart as PieChartIcon,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Receipt,
  Banknote,
  Scale,
  SlidersHorizontal,
  RotateCw,
  ShoppingBag,
  Zap,
} from "lucide-react";
import { addDays, addMonths, format, subDays } from "date-fns";
import { formatReadableDateTime, formatReadableTime } from "@/lib/date-format";
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
import { StatusBadge, PaymentBadge, STATUS_ICONS } from "@/components/status-badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type ExportSection = "transactions" | "analytics" | "customers";
type ForecastRange = "7d" | "30d" | "3m" | "6m" | "custom";
type RangePreset = "day" | "week" | "month" | "year" | "custom";
type ReportsPageProps = {
  transactions: Transaction[];
  shopName?: string;
  onRefresh?: () => Promise<void> | void;
  loading?: boolean;
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

const PIE_COLORS = ["hsl(257 58% 49%)", "hsl(142 71% 45%)", "hsl(214 62% 59%)", "hsl(39 79% 54%)", "hsl(266 17% 53%)", "hsl(44 83% 61%)"];
const BUSY_BAR = "hsl(257 58% 49%)";
const EMERALD_BAR = "hsl(142 71% 45%)";
const NORMAL_BAR = "hsl(257 58% 49% / 0.35)";
const MUTED_BAR = "hsl(35 28% 88%)";
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

function getServiceIcon(_service: string) {
  return <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />;
}

function getStatusIconComponent(status: string) {
  const Icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] ?? Inbox;
  return <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}

function getDateKey(transaction: Transaction) {
  return transaction.dropOffDate;
}

function getPaymentDateKey(transaction: Transaction): string | null {
  if (transaction.paidAt) {
    const match = transaction.paidAt.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  if (transaction.paymentStatus === "paid") {
    // Graceful fallback for transactions without explicit paidAt timestamp
    return transaction.dropOffDate || (transaction.arrivalDateTime ? transaction.arrivalDateTime.split(" ")[0] : null);
  }
  return null;
}

function getPaymentHourLabel(transaction: Transaction): string {
  const timeSource = transaction.paidAt || transaction.arrivalDateTime;
  if (!timeSource) return "Unknown";
  const match = timeSource.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "Unknown";
  const hour = Number(match[1]);
  if (Number.isNaN(hour)) return "Unknown";

  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour}${suffix}`;
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

export default function ReportsPage({ transactions, shopName = "LaundryTrack", onRefresh, loading = false }: ReportsPageProps) {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [mobileStatusFilter, setMobileStatusFilter] = useState<string>("all");
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
  const [rangePreset, setRangePreset] = useState<RangePreset>("month");

  useEffect(() => {
    void onRefresh?.();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "hidden") {
        void onRefresh?.();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  const periodRanges = {
    day: { from: new Date(), to: new Date() },
    week: { from: subDays(new Date(), 6), to: new Date() },
    month: { from: subDays(new Date(), 29), to: new Date() },
    year: { from: subDays(new Date(), 364), to: new Date() },
  };

  const applyPreset = (preset: RangePreset) => {
    setRangePreset(preset);
    if (preset !== "custom") {
      setExportFromDate(periodRanges[preset].from);
      setExportToDate(periodRanges[preset].to);
    }
  };

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

  const readyCount = useMemo(
    () => transactions.filter((transaction) => transaction.status === "Ready").length,
    [transactions],
  );
  const washingCount = useMemo(
    () => transactions.filter((transaction) => transaction.status === "Washing" || transaction.status === "Drying").length,
    [transactions],
  );
  const receivedCount = useMemo(
    () => transactions.filter((transaction) => transaction.status === "Received").length,
    [transactions],
  );
  const totalRevenue = useMemo(
    () => transactions.reduce((sum, transaction) => sum + transaction.fee, 0),
    [transactions],
  );
  const totalWeight = useMemo(
    () => transactions.reduce((sum, transaction) => sum + (transaction.weight || 0), 0),
    [transactions],
  );

  const activeOrdersCount = readyCount + washingCount + receivedCount;
  const readyPct = activeOrdersCount > 0 ? Math.round((readyCount / activeOrdersCount) * 100) : 0;
  const washingPct = activeOrdersCount > 0 ? Math.round((washingCount / activeOrdersCount) * 100) : 0;
  const receivedPct = activeOrdersCount > 0 ? Math.max(0, 100 - readyPct - washingPct) : 0;

  const summaryCards = useMemo(() => {
    return [
      { label: "Total Transactions", value: transactions.length.toLocaleString(), sub: "Realtime" },
      { label: "Total Revenue", value: formatCurrency(totalRevenue), sub: "Realtime" },
      { label: "Total Weight", value: `${totalWeight.toFixed(1)} kg`, sub: "Processed" },
      { label: "Ready for Pickup", value: readyCount.toLocaleString(), sub: "Current queue" },
    ];
  }, [readyCount, totalRevenue, totalWeight, transactions.length]);

  const dailyTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.dropOffDate === summaryDateKey),
    [summaryDateKey, transactions],
  );

  const dailyReadyCount = useMemo(
    () => dailyTransactions.filter((t) => t.status === "Ready").length,
    [dailyTransactions],
  );
  const dailyWashingCount = useMemo(
    () => dailyTransactions.filter((t) => t.status === "Washing" || t.status === "Drying").length,
    [dailyTransactions],
  );
  const dailyReceivedCount = useMemo(
    () => dailyTransactions.filter((t) => t.status === "Received").length,
    [dailyTransactions],
  );
  const displayedDailyTransactions = useMemo(() => {
    if (mobileStatusFilter === "all") return dailyTransactions;
    if (mobileStatusFilter === "Washing") {
      return dailyTransactions.filter((t) => t.status === "Washing" || t.status === "Drying");
    }
    return dailyTransactions.filter((t) => t.status === mobileStatusFilter);
  }, [dailyTransactions, mobileStatusFilter]);

  const recognizedRevenueTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        if (transaction.paymentStatus !== "paid" || transaction.status === "Voided") {
          return false;
        }
        const payDateKey = getPaymentDateKey(transaction);
        if (!payDateKey) return false;
        return payDateKey >= exportFrom && payDateKey <= exportTo;
      }),
    [exportFrom, exportTo, transactions],
  );

  const outstandingTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        if (transaction.paymentStatus !== "unpaid" || transaction.status === "Voided") {
          return false;
        }
        const dateKey = getDateKey(transaction);
        return dateKey >= exportFrom && dateKey <= exportTo;
      }),
    [exportFrom, exportTo, transactions],
  );

  const totalRecognizedRevenue = useMemo(
    () => recognizedRevenueTransactions.reduce((sum, transaction) => sum + transaction.fee, 0),
    [recognizedRevenueTransactions],
  );

  const totalOutstandingBalance = useMemo(
    () => outstandingTransactions.reduce((sum, transaction) => sum + transaction.fee, 0),
    [outstandingTransactions],
  );

  const totalPaidTransactions = recognizedRevenueTransactions.length;

  const serviceRevenue = useMemo<ServiceRevenueRow[]>(() => {
    const serviceMap = new Map<string, ServiceRevenueRow>();
    for (const transaction of recognizedRevenueTransactions) {
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
  }, [recognizedRevenueTransactions]);

  const serviceMixData = useMemo(
    () => serviceRevenue.map((row) => ({ name: row.service, value: row.revenue, count: row.count })),
    [serviceRevenue],
  );

  const paymentMixData = useMemo(() => {
    return [
      { name: "Paid", value: totalRecognizedRevenue },
      { name: "Unpaid", value: totalOutstandingBalance },
    ];
  }, [totalRecognizedRevenue, totalOutstandingBalance]);

  const statusMixData = useMemo(() => {
    const statusMap = new Map<string, number>();
    for (const transaction of filteredTransactions) {
      if (transaction.status === "Voided") continue;
      statusMap.set(transaction.status, (statusMap.get(transaction.status) ?? 0) + 1);
    }
    return [...statusMap.entries()].map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const salesTrendData = useMemo(() => {
    const salesMap = new Map<string, { label: string; revenue: number; count: number }>();
    const seed = (key: string, label: string) => {
      salesMap.set(key, { label, revenue: 0, count: 0 });
    };

    if (rangePreset === "day") {
      for (let hour = 0; hour < 24; hour += 1) {
        const label = format(new Date(0, 0, 0, hour, 0, 0), "ha");
        seed(label, label);
      }
      for (const transaction of recognizedRevenueTransactions) {
        const label = getPaymentHourLabel(transaction);
        const existing = salesMap.get(label);
        if (!existing) continue;
        existing.revenue += transaction.fee;
        existing.count += 1;
      }
    } else if (rangePreset === "year") {
      for (let month = exportFromDate; month <= exportToDate; month = addMonths(month, 1)) {
        const key = format(month, "MMM yyyy");
        seed(key, key);
      }
      for (const transaction of recognizedRevenueTransactions) {
        const payDateKey = getPaymentDateKey(transaction);
        if (!payDateKey) continue;
        const key = format(new Date(`${payDateKey}T00:00:00`), "MMM yyyy");
        const existing = salesMap.get(key);
        if (!existing) continue;
        existing.revenue += transaction.fee;
        existing.count += 1;
      }
    } else {
      for (let day = exportFromDate; day <= exportToDate; day = addDays(day, 1)) {
        const key = format(day, "yyyy-MM-dd");
        seed(key, format(day, "MMM d"));
      }
      for (const transaction of recognizedRevenueTransactions) {
        const payDateKey = getPaymentDateKey(transaction);
        if (!payDateKey) continue;
        const existing = salesMap.get(payDateKey);
        if (!existing) continue;
        existing.revenue += transaction.fee;
        existing.count += 1;
      }
    }

    return [...salesMap.values()];
  }, [rangePreset, exportFromDate, exportToDate, recognizedRevenueTransactions]);

  const highestPeakDay = useMemo(() => {
    if (salesTrendData.length === 0) return null;
    return [...salesTrendData].sort((a, b) => b.revenue - a.revenue)[0];
  }, [salesTrendData]);

  const peakHourData = useMemo(() => {
    const hourMap = new Map<string, number>();

    for (const transaction of recognizedRevenueTransactions) {
      const label = getPaymentHourLabel(transaction);
      hourMap.set(label, (hourMap.get(label) ?? 0) + 1);
    }

    return [...hourMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [recognizedRevenueTransactions]);

  const unclaimedItems = useMemo(
    () => transactions.filter((transaction) => transaction.status === "Ready"),
    [transactions],
  );

  const customerRows = useMemo(() => getCustomerSummaryRows(filteredTransactions), [filteredTransactions]);

  const totalFilteredRevenue = totalRecognizedRevenue;
  const totalFilteredTransactions = totalPaidTransactions;
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
      rows.push(["Collected Revenue", String(totalRecognizedRevenue)]);
      rows.push(["Paid Orders", String(totalPaidTransactions)]);
      rows.push(["Outstanding Balance", String(totalOutstandingBalance)]);
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
    <div className="min-h-[60vh] space-y-4">
      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-semibold text-foreground">Reports</h2>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void onRefresh?.()}
            disabled={loading}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-primary")} />
            <span>Refresh</span>
          </Button>
          <p className="text-xs text-muted-foreground">{transactions.length} total transactions</p>
        </div>
      </div>

      {/* Mobile Concept Header */}
      <div className="flex items-center justify-between gap-2 pt-1 pb-0.5 md:hidden">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Reports</h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">Business analytics & daily laundry summaries</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void onRefresh?.()}
          disabled={loading}
          className="h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
        >
          <RotateCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-primary")} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {transactions.length === 0 && (
        <Card className="border border-border shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No report data yet. Add transactions to populate analytics and export sections.
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* Mobile Horizontal Pill Navigation Bar */}
        <div className="w-full overflow-x-auto no-scrollbar py-0.5 flex items-center gap-1.5 md:hidden">
          {[
            { id: "overview", label: "Daily Summary", icon: FileText },
            { id: "analytics", label: "Sales Analytics", icon: TrendingUp },
            { id: "forecast", label: "Forecast", icon: Lightbulb },
            { id: "unclaimed", label: "Unclaimed", icon: PackageCheck },
            { id: "export", label: "Export", icon: Download },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs whitespace-nowrap transition-all active:scale-95",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop TabsList */}
        <div className="hidden md:block">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/40 p-1 sm:flex sm:h-9">
            <TabsTrigger value="overview" className="min-h-[40px] text-xs sm:min-h-0">Daily Summary</TabsTrigger>
            <TabsTrigger value="analytics" className="min-h-[40px] text-xs sm:min-h-0">Sales Analytics</TabsTrigger>
            <TabsTrigger value="forecast" className="min-h-[40px] text-xs sm:min-h-0">Forecast</TabsTrigger>
            <TabsTrigger value="unclaimed" className="min-h-[40px] text-xs sm:min-h-0">Unclaimed Items</TabsTrigger>
            <TabsTrigger value="export" className="min-h-[40px] text-xs sm:min-h-0">Export</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          {/* Mobile 2x2 Metric Summary Grid */}
          <div className="grid grid-cols-2 gap-2.5 md:hidden">
            {/* Card 1: Transactions */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-muted-foreground">Transactions</span>
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-foreground tracking-tight">{transactions.length}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                  <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Realtime</span>
                </div>
              </div>
            </div>

            {/* Card 2: Total Revenue */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total Revenue</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-extrabold text-primary tracking-tight">{formatCurrency(totalRevenue)}</span>
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Realtime</span>
                </div>
              </div>
            </div>

            {/* Card 3: Total Weight */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total Weight</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Scale className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-foreground tracking-tight">{totalWeight.toFixed(1)}</span>
                  <span className="text-xs font-semibold text-foreground">kg</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                  <span>Processed</span>
                </div>
              </div>
            </div>

            {/* Card 4: Ready Pickup */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-muted-foreground">Ready Pickup</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <PackageCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-extrabold text-foreground tracking-tight">{readyCount}</span>
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Current queue</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Operational Flow Progress Visualizer */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-2 md:hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Daily Capacity & Wash Cycles</span>
              <span className="text-[11px] font-bold text-primary">
                {activeOrdersCount > 0 ? `${Math.round((readyCount / activeOrdersCount) * 100)}% Ready` : "Idle"}
              </span>
            </div>
            <div className="w-full h-2.5 bg-muted/60 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${readyPct}%` }} title={`Ready: ${readyCount}`} />
              <div className="bg-blue-500 transition-all duration-500" style={{ width: `${washingPct}%` }} title={`Washing: ${washingCount}`} />
              <div className="bg-violet-500 transition-all duration-500" style={{ width: `${receivedPct}%` }} title={`Received: ${receivedCount}`} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Ready ({readyCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>Wash ({washingCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                <span>Received ({receivedCount})</span>
              </div>
            </div>
          </div>

          {/* Mobile Date Selection Banner & Quick Filter Chips */}
          <div className="flex flex-col gap-2 md:hidden">
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-foreground truncate">{format(summaryDate, "MMM d, yyyy")}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{format(summaryDate, "EEEE")} • Daily Summary</span>
                </div>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 rounded-xl px-2.5 text-xs font-semibold">
                    <SlidersHorizontal className="w-3 h-3 text-muted-foreground" />
                    <span>Date</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={summaryDate} onSelect={(date) => date && setSummaryDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: "all", label: `All (${dailyTransactions.length})` },
                { id: "Ready", label: `Ready (${dailyReadyCount})` },
                { id: "Washing", label: `Washing (${dailyWashingCount})` },
                { id: "Received", label: `Received (${dailyReceivedCount})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setMobileStatusFilter(pill.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition-all",
                    mobileStatusFilter === pill.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Daily Transactions Card List */}
          <div className="space-y-2.5 md:hidden">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-bold text-foreground">Recent Logs</span>
              <span className="text-[11px] text-muted-foreground">
                Showing {displayedDailyTransactions.length} of {dailyTransactions.length}
              </span>
            </div>
            {displayedDailyTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm space-y-2.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs font-bold text-primary">#{transaction.ticketId}</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span className="text-xs font-bold text-foreground truncate">{transaction.customerName}</span>
                  </div>
                  <StatusBadge status={transaction.status} className="shrink-0" />
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-muted-foreground/70" />
                      <span>{formatReadableTime(transaction.arrivalDateTime) || transaction.arrivalDateTime}</span>
                    </span>
                    <span className="flex items-center gap-1 truncate">
                      <Sparkles className="w-3 h-3 text-primary/70 shrink-0" />
                      <span className="truncate">{transaction.washType} ({transaction.weight} kg)</span>
                    </span>
                  </div>
                  <span className="font-bold text-foreground shrink-0 text-xs">{formatCurrency(transaction.fee)}</span>
                </div>
              </div>
            ))}
            {displayedDailyTransactions.length === 0 && (
              <Empty className="px-4 py-8 border border-dashed rounded-2xl">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm">No transactions found for this date.</EmptyTitle>
                  <EmptyDescription>Pick a different date or add transactions for this day.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>

          {/* Desktop Overview Section */}
          <div className="hidden md:block space-y-4">
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
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatReadableDateTime(transaction.arrivalDateTime) || transaction.arrivalDateTime}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{transaction.washType}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{transaction.weight} kg</td>
                          <td className="px-4 py-3 text-xs font-semibold text-foreground">{formatCurrency(transaction.fee)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={transaction.status} />
                          </td>
                        </tr>
                      ))}
                      {dailyTransactions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-10">
                            <Empty>
                              <EmptyHeader>
                                <EmptyMedia variant="icon">
                                  <Inbox />
                                </EmptyMedia>
                                <EmptyTitle className="text-sm">No transactions found for this date.</EmptyTitle>
                                <EmptyDescription>Pick a different date or add transactions for this day.</EmptyDescription>
                              </EmptyHeader>
                            </Empty>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      <TabsContent value="analytics" className="space-y-4">
        {/* Mobile Concept View */}
        <div className="space-y-4 md:hidden">
          {/* Mobile Period Selector & Custom Date Pickers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-card rounded-2xl p-1.5 border border-border/80 shadow-sm">
              <span className="text-xs font-bold text-muted-foreground pl-2">Period</span>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {(["day", "week", "month", "year", "custom"] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-xl capitalize transition-all whitespace-nowrap",
                      rangePreset === preset
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {rangePreset === "custom" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {/* From Date Picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-xl font-normal justify-start truncate">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{format(exportFromDate, "MMM dd")}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={exportFromDate}
                      onSelect={(d) => {
                        if (d) {
                          setExportFromDate(d);
                          if (d > exportToDate) setExportToDate(d);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* To Date Picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-xl font-normal justify-start truncate">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{format(exportToDate, "MMM dd")}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={exportToDate}
                      onSelect={(d) => {
                        if (d) {
                          setExportToDate(d);
                          if (d < exportFromDate) setExportFromDate(d);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Mobile 2x2 Metric Summary Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Card 1: Collected Revenue */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Collected Revenue</span>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  ₱
                </div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-foreground tracking-tight">{formatCurrency(totalRecognizedRevenue)}</div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">Paid: {exportFrom} to {exportTo}</p>
              </div>
            </div>

            {/* Card 2: Orders in Range */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Orders in Range</span>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-foreground tracking-tight">{totalPaidTransactions}</div>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Paid Orders</span>
                </div>
              </div>
            </div>

            {/* Card 3: Avg Order Value */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Avg. Order Value</span>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-foreground tracking-tight">{formatCurrency(Math.round(averageOrderValue))}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Per paid transaction</p>
              </div>
            </div>

            {/* Card 4: Outstanding */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Outstanding</span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-foreground tracking-tight">{formatCurrency(totalOutstandingBalance)}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{outstandingTransactions.length} unpaid orders</p>
              </div>
            </div>
          </div>

          {/* Mobile Sales Trend Card */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Sales Trend</h3>
                <p className="text-[11px] text-muted-foreground">Daily revenue performance</p>
              </div>
              <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20 capitalize">
                {rangePreset === "custom" ? "Custom" : `Last ${rangePreset}`}
              </span>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(33 18% 82%)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="hsl(257 58% 49%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {highestPeakDay && highestPeakDay.revenue > 0 && (
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span>Highest peak day</span>
                </span>
                <span className="font-bold text-foreground">{highestPeakDay.label} ({formatCurrency(highestPeakDay.revenue)})</span>
              </div>
            )}
          </div>

          {/* Mobile Market & Sales Mix */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <PieChartIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Market &amp; Sales Mix</h3>
                  <p className="text-[11px] text-muted-foreground">Load demand distribution</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{totalFilteredTransactions} Orders</span>
            </div>

            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={serviceMixData} dataKey="value" nameKey="name" outerRadius={75} innerRadius={42}>
                    {serviceMixData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-1">
              {serviceMixData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1 text-[11px] text-foreground font-medium">
                  <span className="p-0.5 rounded bg-muted/60">
                    {getServiceIcon(entry.name)}
                  </span>
                  <span>{entry.name} ({entry.count})</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top Service</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{serviceRevenue[0]?.service ?? "-"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-primary">{serviceRevenue[0] ? formatCurrency(serviceRevenue[0].revenue) : "-"}</p>
                <p className="text-[10px] text-muted-foreground">{serviceRevenue[0]?.count ?? 0} txns</p>
              </div>
            </div>
          </div>

          {/* Mobile Payment & Status Split Grid */}
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-foreground">Payment Split</h4>
              <div className="h-[170px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMixData} dataKey="value" nameKey="name" outerRadius={68}>
                      <Cell fill="hsl(142 71% 45%)" />
                      <Cell fill="hsl(0 84% 60%)" />
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs font-semibold">
                {paymentMixData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    {item.name === "Paid" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0" />
                    )}
                    <span>{item.name}: {formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-foreground">Status Distribution</h4>
              <div className="h-[170px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusMixData} dataKey="value" nameKey="name" outerRadius={68}>
                      {statusMixData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
                {statusMixData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1 text-muted-foreground font-medium">
                    {getStatusIconComponent(entry.name)}
                    <span>{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Service Revenue Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-bold text-foreground">Service Revenue</span>
              <span className="text-[11px] text-muted-foreground">{serviceRevenue.length} services</span>
            </div>
            {serviceRevenue.map((row) => (
              <div key={row.service} className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">{row.service}</p>
                    <p className="text-[11px] text-muted-foreground">{row.count} orders</p>
                  </div>
                  <p className="text-xs font-bold text-primary shrink-0">{formatCurrency(row.revenue)}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
                  <span>Avg. per order</span>
                  <span className="font-semibold text-foreground">{formatCurrency(Math.round(row.revenue / Math.max(row.count, 1)))}</span>
                </div>
              </div>
            ))}
            {serviceRevenue.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
                No analytics data available for the selected range.
              </div>
            )}
          </div>
        </div>

        {/* Desktop View (Unchanged) */}
        <div className="hidden md:block space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Period:</span>
            {(["day", "week", "month", "year", "custom"] as const).map((preset) => (
              <Button
                key={preset}
                size="sm"
                variant={rangePreset === preset ? "default" : "outline"}
                className="h-8 text-xs capitalize"
                onClick={() => applyPreset(preset)}
              >
                {preset}
              </Button>
            ))}

            {rangePreset === "custom" && (
              <div className="flex flex-wrap items-center gap-2 ml-1 sm:ml-2 pl-2 border-l border-border">
                {/* From Date Picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-normal">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>From: {format(exportFromDate, "MMM dd, yyyy")}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={exportFromDate}
                      onSelect={(d) => {
                        if (d) {
                          setExportFromDate(d);
                          if (d > exportToDate) setExportToDate(d);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-xs text-muted-foreground">to</span>

                {/* To Date Picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-normal">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>To: {format(exportToDate, "MMM dd, yyyy")}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={exportToDate}
                      onSelect={(d) => {
                        if (d) {
                          setExportToDate(d);
                          if (d < exportFromDate) setExportFromDate(d);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Collected Revenue</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(totalRecognizedRevenue)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Payment Date: {exportFrom} to {exportTo}</p>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Orders in Range</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{totalPaidTransactions}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Paid orders</p>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Average Order Value</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(Math.round(averageOrderValue))}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Per paid transaction</p>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(totalOutstandingBalance)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{outstandingTransactions.length} unpaid orders</p>
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
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(33 18% 82%)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                      <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="hsl(257 58% 49%)" />
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
              <CardContent className="space-y-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={serviceMixData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={45}>
                        {serviceMixData.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Icon Legend for Services */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1">
                  {serviceMixData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                      <span className="p-0.5 rounded-md bg-muted/60">
                        {getServiceIcon(entry.name)}
                      </span>
                      <span>{entry.name}</span>
                    </div>
                  ))}
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
              <CardContent className="space-y-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentMixData} dataKey="value" nameKey="name" outerRadius={78}>
                        <Cell fill="hsl(142 71% 45%)" />
                        <Cell fill="hsl(0 84% 60%)" />
                      </Pie>
                      <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Icon Legend for Payment Split */}
                <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
                  {paymentMixData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                      {item.name === "Paid" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0" />
                      )}
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusMixData} dataKey="value" nameKey="name" outerRadius={78}>
                        {statusMixData.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Icon Legend for Status Distribution */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1">
                  {statusMixData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                      {getStatusIconComponent(entry.name)}
                      <span>{entry.name}</span>
                    </div>
                  ))}
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
        </div>
      </TabsContent>

      <TabsContent value="forecast" className="space-y-4">
        {/* Mobile Concept View */}
        <div className="space-y-4 md:hidden">
          {/* Mobile Date Range & Filter Banner */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-foreground truncate">
                    {format(forecastDates.from, "MMM d")} – {format(forecastDates.to, "MMM d, yyyy")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{forecastMetrics.rangeTransactions.length} transactions</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Select value={forecastRange} onValueChange={(value) => setForecastRange(value as ForecastRange)}>
                  <SelectTrigger className="h-8 w-[115px] text-[11px] rounded-xl font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {forecastRangeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-xl shrink-0"
                  disabled={forecastPdfGenerating}
                  onClick={handleForecastPdfExport}
                  title="Export Forecast Report"
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {forecastRange === "custom" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-xl font-normal justify-start truncate">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{format(forecastDates.from, "MMM dd")}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={forecastDates.from} onSelect={(date) => date && setForecastFromDate(date)} initialFocus />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-xl font-normal justify-start truncate">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{format(forecastDates.to, "MMM dd")}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={forecastDates.to} onSelect={(date) => date && setForecastToDate(date)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Mobile 4 Key Predictive Indicators (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* KPI 1: Best Day to Staff Up */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block leading-tight">Best Day to Staff Up</span>
                <h3 className="text-xl font-extrabold text-foreground mt-1 tracking-tight">{forecastMetrics.busiestDay}</h3>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center leading-tight">
                  <TrendingUp className="w-3 h-3 mr-0.5 inline shrink-0" />
                  {forecastMetrics.staffLift > 0 ? `Expect +${forecastMetrics.staffLift}% load` : "Normal load"}
                </p>
              </div>
            </div>

            {/* KPI 2: Peak Drop-off Time */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block leading-tight">Peak Drop-off Time</span>
                <h3 className="text-sm font-extrabold text-foreground mt-1 tracking-tight">{forecastMetrics.peak}</h3>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Highest volume window</p>
              </div>
            </div>

            {/* KPI 3: Busiest Week */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block leading-tight">Busiest Week</span>
                <h3 className="text-xl font-extrabold text-foreground mt-1 tracking-tight">
                  {forecastMetrics.busiestWeek ? `Week ${forecastMetrics.busiestWeek}` : "-"}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Strongest monthly trend</p>
              </div>
            </div>

            {/* KPI 4: Weather Impact */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center mb-2">
                <CloudRain className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block leading-tight">Weather Impact</span>
                <h3 className="text-sm font-extrabold text-foreground mt-1 tracking-tight">Not connected</h3>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Weather data unavailable</p>
              </div>
            </div>
          </div>

          {/* Mobile Staffing Recommendation Alert */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50/60 dark:from-purple-950/20 dark:to-indigo-950/20 p-3.5 rounded-2xl border border-primary/30 shadow-sm flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground tracking-wide uppercase">Staffing Recommendation</h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {forecastMetrics.insight}
              </p>
            </div>
          </div>

          {/* Mobile Predicted Busy Days Chart */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Predicted Busy Days</h3>
                <p className="text-[11px] text-muted-foreground">Based on historical transaction patterns</p>
              </div>
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                Weekly
              </span>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastMetrics.busyDays}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(33 18% 82%)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => [value, "Predicted customers"]} />
                  <Bar dataKey="customers" radius={[6, 6, 0, 0]}>
                    {forecastMetrics.busyDays.map((entry) => (
                      <Cell key={entry.label} fill={entry.label === forecastMetrics.busiestDay ? BUSY_BAR : NORMAL_BAR} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40">
              <div className="rounded-xl bg-muted/40 p-2">Busiest Day: <span className="font-bold text-foreground">{forecastMetrics.busiestDay}</span></div>
              <div className="rounded-xl bg-muted/40 p-2">Slowest Day: <span className="font-bold text-foreground">{forecastMetrics.slowestDay}</span></div>
            </div>
          </div>

          {/* Mobile Predicted Peak Hours Chart */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Predicted Peak Hours</h3>
                <p className="text-[11px] text-muted-foreground">When most customers drop off laundry</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Rush Window</span>
              </div>
            </div>
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastMetrics.busyHours} layout="vertical" margin={{ left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(33 18% 82%)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" width={42} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => [value, "Predicted customers"]} />
                  <Bar dataKey="customers" radius={[0, 6, 6, 0]}>
                    {forecastMetrics.busyHours.map((entry) => (
                      <Cell key={entry.label} fill={forecastMetrics.peak.includes(entry.label) ? BUSY_BAR : MUTED_BAR} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40">
              <div className="rounded-xl bg-muted/40 p-2">Peak Hours: <span className="font-bold text-foreground">{forecastMetrics.peak}</span></div>
              <div className="rounded-xl bg-muted/40 p-2">Second Peak: <span className="font-bold text-foreground">{forecastMetrics.secondPeak}</span></div>
            </div>
          </div>

          {/* Mobile Monthly Customer Trend */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Monthly Customer Trend</h3>
                <p className="text-[11px] text-muted-foreground">Transaction volume over past months</p>
              </div>
              <p className={cn("text-xs font-bold", forecastMetrics.trendPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                {forecastMetrics.trendPercent >= 0 ? "↑" : "↓"} {Math.abs(forecastMetrics.trendPercent)}%
              </p>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastMetrics.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(33 18% 82%)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => [value, "Transactions"]} />
                  <Line type="monotone" dataKey="transactions" stroke="hsl(257 58% 49%)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(257 58% 49%)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Desktop View (Unchanged) */}
        <div className="hidden md:block space-y-4">
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
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(33 18% 82%)" vertical={false} />
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
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(33 18% 82%)" horizontal={false} />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(33 18% 82%)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value: number) => [value, "Transactions"]} />
                    <Line type="monotone" dataKey="transactions" stroke="hsl(257 58% 49%)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(257 58% 49%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className={cn("text-sm font-semibold", forecastMetrics.trendPercent >= 0 ? "text-emerald-600" : "text-destructive")}>
                {forecastMetrics.trendPercent >= 0 ? "Up" : "Down"} {Math.abs(forecastMetrics.trendPercent)}% vs last month
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-none">
            <CardContent className="flex gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Forecast insight</p>
                <p className="mt-1 text-sm leading-6 text-foreground">{forecastMetrics.insight}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="unclaimed">
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Ready but Unclaimed Items ({unclaimedItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-2.5 p-3 md:hidden">
              {unclaimedItems.map((transaction) => (
                <div key={transaction.id} className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-primary">#{transaction.ticketId}</span>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                      <span className="text-xs font-bold text-foreground truncate">{transaction.customerName}</span>
                    </div>
                    <PaymentBadge paymentStatus={transaction.paymentStatus} className="shrink-0 font-bold uppercase" />
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3 text-muted-foreground/70" />
                        <span>{formatReadableTime(transaction.arrivalDateTime) || transaction.arrivalDateTime}</span>
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <Sparkles className="w-3 h-3 text-primary/70 shrink-0" />
                        <span className="truncate">{transaction.washType} ({transaction.weight} kg)</span>
                      </span>
                    </div>
                    <span className="font-bold text-foreground shrink-0 text-xs">{formatCurrency(transaction.fee)}</span>
                  </div>
                </div>
              ))}
              {unclaimedItems.length === 0 && (
                <Empty className="px-4 py-8 border border-dashed rounded-2xl">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <PackageCheck />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm">No ready-for-pickup items at the moment.</EmptyTitle>
                    <EmptyDescription>Items marked Ready will appear here for claiming.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
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
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatReadableDateTime(transaction.arrivalDateTime) || transaction.arrivalDateTime}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{transaction.washType}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-foreground">{formatCurrency(transaction.fee)}</td>
                      <td className="px-4 py-3">
                        <PaymentBadge paymentStatus={transaction.paymentStatus} className="font-bold uppercase" />
                      </td>
                    </tr>
                  ))}
                  {unclaimedItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10">
                        <Empty>
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <PackageCheck />
                            </EmptyMedia>
                            <EmptyTitle className="text-sm">No ready-for-pickup items at the moment.</EmptyTitle>
                            <EmptyDescription>Items marked Ready will appear here for claiming.</EmptyDescription>
                          </EmptyHeader>
                        </Empty>
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
