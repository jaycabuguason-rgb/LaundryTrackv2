"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Download,
  ScrollText,
  ShieldCheck,
  Receipt,
  QrCode,
  Star,
  Settings2,
  UserCog,
  LogIn,
  FileBarChart2,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const ACTION_TYPES: AuditActionType[] = [
  "all",
  "transaction_created",
  "transaction_updated",
  "status_changed",
  "claim_verified",
  "loyalty_stamp",
  "reward_redeemed",
  "settings_changed",
  "staff_created",
  "staff_updated",
  "staff_deactivated",
  "staff_reactivated",
  "staff_password_reset",
  "login",
  "logout",
  "report_exported",
  "other",
];

const ACTION_LABELS: Record<AuditActionType, string> = {
  all: "All Actions",
  transaction_created: "Transaction Created",
  transaction_updated: "Transaction Updated",
  status_changed: "Status Changed",
  claim_verified: "Claim Verified",
  loyalty_stamp: "Loyalty Stamp Added",
  reward_redeemed: "Reward Redeemed",
  settings_changed: "Settings Changed",
  staff_created: "Staff Account Created",
  staff_updated: "Staff Account Updated",
  staff_deactivated: "Staff Account Deactivated",
  staff_reactivated: "Staff Account Reactivated",
  staff_password_reset: "Staff Password Reset",
  login: "Login",
  logout: "Logout",
  report_exported: "Report Exported",
  other: "Other",
};

const ACTION_ICONS: Record<AuditActionType, React.ElementType> = {
  all: ScrollText,
  transaction_created: Receipt,
  transaction_updated: Receipt,
  status_changed: Receipt,
  claim_verified: QrCode,
  loyalty_stamp: Star,
  reward_redeemed: Star,
  settings_changed: Settings2,
  staff_created: UserCog,
  staff_updated: UserCog,
  staff_deactivated: UserCog,
  staff_reactivated: UserCog,
  staff_password_reset: UserCog,
  login: LogIn,
  logout: LogIn,
  report_exported: FileBarChart2,
  other: ShieldCheck,
};

const ACTION_COLORS: Record<AuditActionType, string> = {
  all: "bg-muted text-muted-foreground",
  transaction_created: "bg-blue-50 text-blue-700",
  transaction_updated: "bg-blue-50 text-blue-600",
  status_changed: "bg-indigo-50 text-indigo-700",
  claim_verified: "bg-green-50 text-green-700",
  loyalty_stamp: "bg-yellow-50 text-yellow-700",
  reward_redeemed: "bg-orange-50 text-orange-700",
  settings_changed: "bg-slate-100 text-slate-700",
  staff_created: "bg-teal-50 text-teal-700",
  staff_updated: "bg-cyan-50 text-cyan-700",
  staff_deactivated: "bg-red-50 text-red-600",
  staff_reactivated: "bg-emerald-50 text-emerald-700",
  staff_password_reset: "bg-violet-50 text-violet-700",
  login: "bg-muted text-muted-foreground",
  logout: "bg-muted text-muted-foreground",
  report_exported: "bg-purple-50 text-purple-700",
  other: "bg-muted text-muted-foreground",
};

function formatTimestamp(iso: string) {
  const value = new Date(iso);
  return value.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ACTION_ICONS[entry.action] ?? ShieldCheck;
  const colorClass = ACTION_COLORS[entry.action] ?? ACTION_COLORS.other;

  return (
    <div className="border-b border-border last:border-0">
      <button
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 md:px-5"
        onClick={() => setExpanded((current) => !current)}
      >
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${colorClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold text-foreground">{entry.staffName}</span>
            <Badge
              variant="secondary"
              className={`px-1.5 py-0 text-[10px] font-medium ${
                entry.staffRole === "Admin"
                  ? "bg-primary/10 text-primary"
                  : entry.staffRole === "Staff"
                    ? "bg-teal-100 text-teal-700"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {entry.staffRole}
            </Badge>
            <span className="text-xs text-muted-foreground">{entry.summary}</span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
            <span className="text-[11px] text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
            <span className="text-[11px] text-muted-foreground/60">{timeAgo(entry.timestamp)}</span>
            {entry.ticketId && (
              <span className="text-[11px] text-muted-foreground/60">Ticket: {entry.ticketId}</span>
            )}
            {entry.ipAddress && (
              <span className="hidden text-[11px] text-muted-foreground/60 md:inline">IP: {entry.ipAddress}</span>
            )}
          </div>
        </div>

        <div className="mt-1 shrink-0 text-muted-foreground/50">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pl-[52px] md:px-5 md:pl-[60px]">
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            {entry.details}
          </p>
          {entry.ipAddress && (
            <p className="mt-1.5 text-[11px] text-muted-foreground md:hidden">IP: {entry.ipAddress}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditLogsPage() {
  const { auditLogs, loading, error, refresh, staffOptions, usingSupabase } = useAuditLogs();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditActionType>("all");
  const [staffFilter, setStaffFilter] = useState("All Staff");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((entry) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const matchesSearch =
          entry.staffName.toLowerCase().includes(query)
          || entry.summary.toLowerCase().includes(query)
          || entry.details.toLowerCase().includes(query)
          || entry.id.toLowerCase().includes(query)
          || entry.ticketId?.toLowerCase().includes(query);

        if (!matchesSearch) {
          return false;
        }
      }

      if (actionFilter !== "all" && entry.action !== actionFilter) {
        return false;
      }

      if (staffFilter !== "All Staff") {
        if (staffFilter === "Admin") {
          if (entry.staffRole !== "Admin") {
            return false;
          }
        } else if (entry.staffName !== staffFilter) {
          return false;
        }
      }

      const dateKey = entry.timestamp.slice(0, 10);
      if (dateFrom && dateKey < dateFrom) {
        return false;
      }
      if (dateTo && dateKey > dateTo) {
        return false;
      }

      return true;
    });
  }, [actionFilter, auditLogs, dateFrom, dateTo, search, staffFilter]);

  const exportCsv = () => {
    const rows = [
      ["ID", "Timestamp", "Staff", "Role", "Action", "Summary", "Details", "Ticket ID", "IP Address"],
      ...filteredLogs.map((entry) => [
        entry.id,
        entry.timestamp,
        entry.staffName,
        entry.staffRole,
        ACTION_LABELS[entry.action] ?? entry.action,
        entry.summary,
        entry.details,
        entry.ticketId ?? "",
        entry.ipAddress ?? "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-logs.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl space-y-5">
      {!usingSupabase && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          Supabase is not configured in this browser session, so Audit Logs is showing demo data.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <Card className="border border-border shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by staff name, ticket ID, action..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>

            <Select value={actionFilter} onValueChange={(value) => setActionFilter(value as AuditActionType)}>
              <SelectTrigger className="h-9 min-w-[170px] text-sm">
                <Filter className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((action) => (
                  <SelectItem key={action} value={action} className="text-sm">
                    {ACTION_LABELS[action]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="h-9 min-w-[140px] text-sm">
                <SelectValue placeholder="All Staff" />
              </SelectTrigger>
              <SelectContent>
                {staffOptions.map((staffOption) => (
                  <SelectItem key={staffOption} value={staffOption} className="text-sm">
                    {staffOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="To date"
            />

            <Button
              variant="outline"
              size="sm"
              className="flex h-9 shrink-0 items-center gap-1.5 text-xs"
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>

            <Button variant="outline" size="sm" className="flex h-9 shrink-0 items-center gap-1.5 text-xs" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border border-border shadow-none">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3 md:px-5">
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
            Log Entries
          </p>
          <span className="text-[11px] text-muted-foreground">
            {filteredLogs.length} result{filteredLogs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading && auditLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Loading audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ScrollText className="mb-3 h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No log entries match your filters.</p>
            <button
              className="mt-2 cursor-pointer text-xs text-primary hover:underline"
              onClick={() => {
                setSearch("");
                setActionFilter("all");
                setStaffFilter("All Staff");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div>
            {filteredLogs.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </Card>

      <p className="text-center text-[11px] text-muted-foreground">
        Audit logs are read-only and update live when new events are written to Supabase.
      </p>
    </div>
  );
}
