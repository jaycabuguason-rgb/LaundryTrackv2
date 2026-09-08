"use client";

import { useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Download,
  ScrollText,
  AlertTriangle,
  Cog,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { AuditActionType, AuditLogEntry } from "@/lib/audit-log-contracts";
import { useAuditLogs } from "@/hooks/use-audit-logs";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Category mapping and badges
// ─────────────────────────────────────────────────────────────────────────────
type LogCategory = "all" | "transaction" | "auth" | "settings" | "security";
type LogSeverity = "all" | "info" | "warning" | "error";

function getLogCategory(action: AuditActionType): "transaction" | "auth" | "settings" | "security" {
  if (action === "login" || action === "logout") return "auth";
  if (
    action.startsWith("staff_") ||
    action === "settings_changed" ||
    action === "report_exported"
  ) {
    return "settings";
  }
  if (action === "claim_verified" || action === "other") return "security";
  return "transaction";
}

function getLogSeverity(entry: AuditLogEntry): "info" | "warning" | "error" {
  if (entry.action === "staff_deactivated") return "warning";
  if (entry.action === "transaction_updated" && entry.details?.toLowerCase().includes("void")) return "warning";
  if (entry.details?.toLowerCase().includes("failed") || entry.details?.toLowerCase().includes("error")) return "error";
  return "info";
}

export function CategoryBadge({ category }: { category: "transaction" | "auth" | "settings" | "security" }) {
  const configs: Record<typeof category, { label: string; className: string }> = {
    transaction: {
      label: "TRANSACTION",
      className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60",
    },
    auth: {
      label: "AUTH",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60",
    },
    settings: {
      label: "SETTINGS",
      className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900/60",
    },
    security: {
      label: "SECURITY",
      className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60",
    },
  };

  const config = configs[category] || configs.transaction;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: "info" | "warning" | "error" }) {
  if (severity === "warning") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        warning
      </span>
    );
  }
  if (severity === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      info
    </span>
  );
}

function formatTableTimestamp(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Row Component (Table row + expandable metadata)
// ─────────────────────────────────────────────────────────────────────────────
function AuditTableRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const category = getLogCategory(entry.action);
  const severity = getLogSeverity(entry);

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className="group border-b border-border/80 hover:bg-muted/40 cursor-pointer transition-colors text-sm"
      >
        {/* Timestamp */}
        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span>{formatTableTimestamp(entry.timestamp)}</span>
          </div>
        </td>

        {/* Actor */}
        <td className="px-4 py-3.5 whitespace-nowrap">
          <span className="font-semibold text-xs text-foreground">{entry.staffName || "System"}</span>
          {entry.staffRole && (
            <span className="ml-1.5 text-[11px] text-muted-foreground">({entry.staffRole})</span>
          )}
        </td>

        {/* Category */}
        <td className="px-4 py-3.5 whitespace-nowrap">
          <CategoryBadge category={category} />
        </td>

        {/* Action */}
        <td className="px-4 py-3.5 font-medium text-xs text-foreground whitespace-nowrap">
          {entry.summary || entry.action}
        </td>

        {/* Details */}
        <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-xs truncate">
          {entry.details || "—"}
        </td>

        {/* Severity */}
        <td className="px-4 py-3.5 whitespace-nowrap text-right">
          <SeverityBadge severity={severity} />
        </td>
      </tr>

      {expanded && (
        <tr className="bg-muted/20 border-b border-border/80">
          <td colSpan={6} className="px-6 py-3.5 text-xs text-muted-foreground space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-background rounded-lg border border-border p-3">
              <div>
                <p className="font-semibold text-foreground">Log ID</p>
                <p className="font-mono text-[11px] truncate">{entry.id}</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Ticket ID</p>
                <p className="font-mono text-[11px]">{entry.ticketId || "N/A"}</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">IP Address</p>
                <p className="font-mono text-[11px]">{entry.ipAddress || "Internal"}</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Action Type</p>
                <p className="font-mono text-[11px]">{entry.action}</p>
              </div>
            </div>
            {entry.details && (
              <p className="text-foreground leading-relaxed">
                <span className="font-semibold">Full Details: </span>
                {entry.details}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Audit Logs View
// ─────────────────────────────────────────────────────────────────────────────
function AuditLogsView({ onTabChange }: { onTabChange?: (tab: "staff" | "audit") => void }) {
  const { auditLogs, loading, error, refresh, usingSupabase } = useAuditLogs();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<LogCategory>("all");
  const [severityFilter, setSeverityFilter] = useState<LogSeverity>("all");

  // Stat metrics
  const totalEntries = auditLogs.length;
  const warningEvents = useMemo(
    () => auditLogs.filter((entry) => getLogSeverity(entry) === "warning" || getLogSeverity(entry) === "error").length,
    [auditLogs]
  );
  const systemActions = useMemo(
    () => auditLogs.filter((entry) => getLogCategory(entry.action) === "settings" || getLogCategory(entry.action) === "security").length,
    [auditLogs]
  );

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((entry) => {
      const category = getLogCategory(entry.action);
      const severity = getLogSeverity(entry);

      if (categoryFilter !== "all" && category !== categoryFilter) return false;
      if (severityFilter !== "all" && severity !== severityFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesStaff = entry.staffName?.toLowerCase().includes(q);
        const matchesTicket = entry.ticketId?.toLowerCase().includes(q);
        const matchesAction = entry.action?.toLowerCase().includes(q);
        const matchesSummary = entry.summary?.toLowerCase().includes(q);
        const matchesDetails = entry.details?.toLowerCase().includes(q);
        if (!matchesStaff && !matchesTicket && !matchesAction && !matchesSummary && !matchesDetails) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, categoryFilter, severityFilter, search]);

  const exportCsv = () => {
    const rows = [
      ["ID", "Timestamp", "Staff", "Role", "Category", "Action", "Summary", "Details", "Ticket ID", "IP Address", "Severity"],
      ...filteredLogs.map((entry) => [
        entry.id,
        entry.timestamp,
        entry.staffName,
        entry.staffRole,
        getLogCategory(entry.action),
        entry.action,
        entry.summary,
        entry.details,
        entry.ticketId ?? "",
        entry.ipAddress ?? "",
        getLogSeverity(entry),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-5">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Staff & Audit Logs</h1>
          <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">Team management and system activity</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-6 border-b border-border">
          <button
            type="button"
            onClick={() => onTabChange?.("staff")}
            className="flex items-center gap-2 pb-2.5 text-sm font-medium transition-colors border-b-2 border-transparent text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Users className="h-4 w-4" />
            Staff Management
          </button>
          <button
            type="button"
            onClick={() => onTabChange?.("audit")}
            className="flex items-center gap-2 pb-2.5 text-sm font-semibold transition-colors border-b-2 border-primary text-primary cursor-pointer"
          >
            <ScrollText className="h-4 w-4" />
            Audit Logs
          </button>
        </div>
      </div>

      {!usingSupabase && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
          Supabase is not configured, showing demo data.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Top 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Total Entries */}
        <Card className="border border-border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center shrink-0">
              <ScrollText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Entries</p>
              <h3 className="text-xl font-bold text-foreground">{totalEntries}</h3>
            </div>
          </CardContent>
        </Card>

        {/* Warning Events */}
        <Card className="border border-border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Warning Events</p>
              <h3 className="text-xl font-bold text-foreground">{warningEvents}</h3>
            </div>
          </CardContent>
        </Card>

        {/* System Actions */}
        <Card className="border border-border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Cog className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">System Actions</p>
              <h3 className="text-xl font-bold text-foreground">{systemActions}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Row */}
      <Card className="border border-border shadow-xs bg-card">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search audit logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 text-sm"
              />
            </div>

            <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val as LogCategory)}>
              <SelectTrigger className="h-9 w-full sm:w-40 text-sm">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="transaction">Transaction</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
                <SelectItem value="security">Security</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={(val) => setSeverityFilter(val as LogSeverity)}>
              <SelectTrigger className="h-9 w-full sm:w-36 text-sm">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs shrink-0 cursor-pointer"
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs shrink-0 cursor-pointer"
              onClick={exportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log Entries Clean Table */}
      <Card className="overflow-hidden border border-border shadow-xs bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actor</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground/40" />
                    Loading audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                    No log entries match your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((entry) => <AuditTableRow key={entry.id} entry={entry} />)
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Audit logs are read-only and record system and user actions for compliance and traceability.
      </p>
    </div>
  );
}

export default function AuditLogsPage({ initialTab = "staff" }: { initialTab?: "staff" | "audit" }) {
  const [activeTab, setActiveTab] = useState<"staff" | "audit">(initialTab);

  if (activeTab === "staff") {
    const StaffManagementPage = require("@/components/pages/staff-management").default;
    return <StaffManagementPage initialTab="staff" onTabChange={setActiveTab} />;
  }

  return <AuditLogsView onTabChange={setActiveTab} />;
}
