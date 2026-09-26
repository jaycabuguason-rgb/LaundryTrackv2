"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  ExternalLink,
  Loader2,
  RefreshCw,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseAppError } from "@/lib/error-catalog";
import { cn } from "@/lib/utils";

interface ConnectionDiagnosticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncStatus: "online" | "offline" | "syncing" | "error";
  pendingChangesCount?: number;
  lastSyncError?: string | null;
  onRetrySync?: () => void;
}

export function ConnectionDiagnosticsDialog({
  open,
  onOpenChange,
  syncStatus,
  pendingChangesCount = 0,
  lastSyncError = null,
  onRetrySync,
}: ConnectionDiagnosticsDialogProps) {
  const [testing, setTesting] = useState(false);

  const parsedError = lastSyncError ? parseAppError(lastSyncError) : null;
  const isCloudOutage =
    syncStatus === "error" || parsedError?.category === "cloud_db_unavailable";

  const handleTestAndSync = () => {
    setTesting(true);
    onRetrySync?.();
    setTimeout(() => {
      setTesting(false);
    }, 1500);
  };

  const getStatusBadge = () => {
    switch (syncStatus) {
      case "online":
        return {
          label: "Online & Synced",
          badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          title: "Connected to Supabase Cloud",
          summary: "All transactions and settings are synchronized with the cloud database.",
        };
      case "syncing":
        return {
          label: "Syncing in Background",
          badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300",
          icon: <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />,
          title: "Sending Changes to Cloud",
          summary: "Queued transactions and settings are being uploaded to the cloud database.",
        };
      case "error":
        return {
          label: isCloudOutage ? "Cloud Disruption" : "Sync Error",
          badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300",
          icon: <Database className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
          title: parsedError?.title || "Cloud Database Temporarily Unreachable",
          summary:
            parsedError?.message ||
            "Unable to synchronize with the cloud database. Local actions are protected in browser storage.",
        };
      case "offline":
      default:
        return {
          label: "Offline Mode",
          badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300",
          icon: <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          title: "Working Locally Offline",
          summary:
            "No internet connection detected. You can safely record orders, mark statuses, and verify tickets.",
        };
    }
  };

  const statusInfo = getStatusBadge();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md p-5 sm:p-6 bg-card border-border">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Connection &amp; Diagnostics
            </DialogTitle>
            <Badge variant="outline" className={cn("text-xs font-semibold px-2 py-0.5 border", statusInfo.badgeClass)}>
              <span className="flex items-center gap-1.5">
                {statusInfo.icon}
                {statusInfo.label}
              </span>
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Real-time status of local data storage, cloud database sync, and network connection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status Diagnostic Card */}
          <div
            className={cn(
              "rounded-xl border p-3.5 space-y-1.5",
              syncStatus === "online"
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-950 dark:bg-emerald-950/20"
                : syncStatus === "syncing"
                  ? "border-blue-200 bg-blue-50/50 dark:border-blue-950 dark:bg-blue-950/20"
                  : isCloudOutage
                    ? "border-rose-200 bg-rose-50/50 dark:border-rose-950 dark:bg-rose-950/20"
                    : "border-amber-200 bg-amber-50/50 dark:border-amber-950 dark:bg-amber-950/20",
            )}
          >
            <p className="text-xs font-bold text-foreground">{statusInfo.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{statusInfo.summary}</p>
            {lastSyncError && (
              <p className="text-[11px] font-mono text-muted-foreground/80 pt-1 border-t border-border/40 truncate">
                Diagnostic detail: {lastSyncError}
              </p>
            )}
          </div>

          {/* Pending Changes Metrics */}
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Sync Queue Status</span>
              <Badge variant="secondary" className="text-xs">
                {pendingChangesCount} pending
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingChangesCount === 0
                ? "Local storage is fully synchronized. Zero changes waiting in queue."
                : `${pendingChangesCount} mutation(s) are stored safely on this device and waiting to push to the cloud.`}
            </p>
          </div>

          {/* Availability Overview */}
          <div className="space-y-2 text-xs">
            <p className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
              Offline Capability Guide
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/60 bg-card p-2.5 space-y-1">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-[11px]">
                  ✓ Works Fully Offline
                </span>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Dashboard, New Orders, Status Changes, Claim Verification &amp; Settings.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-2.5 space-y-1">
                <span className="font-bold text-muted-foreground block text-[11px]">
                  Requires Cloud Sync
                </span>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Sales Reports, Staff Accounts &amp; Multi-device Realtime Feed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Close
          </Button>

          {onRetrySync && (
            <Button
              type="button"
              size="sm"
              onClick={handleTestAndSync}
              disabled={testing}
              className="text-xs h-8 gap-1.5 cursor-pointer bg-primary text-primary-foreground font-semibold"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", testing && "animate-spin")} />
              {testing ? "Testing & Syncing…" : "Retry Sync Now"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
