"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Database, RefreshCw, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseAppError } from "@/lib/error-catalog";
import { cn } from "@/lib/utils";

interface OfflineAccessNoticeProps {
  syncStatus: "online" | "offline" | "syncing" | "error";
  pendingChangesCount: number;
  lastSyncError: string | null;
  onRetrySync: () => void;
  onDismiss: () => void;
}

export default function OfflineAccessNotice({
  syncStatus,
  pendingChangesCount,
  lastSyncError,
  onRetrySync,
  onDismiss,
}: OfflineAccessNoticeProps) {
  const [retrying, setRetrying] = useState(false);

  const parsedError = useMemo(() => {
    if (lastSyncError) {
      return parseAppError(lastSyncError);
    }
    return null;
  }, [lastSyncError]);

  // Determine if this is a cloud database outage vs pure internet offline
  const isCloudOutage =
    syncStatus === "error" ||
    parsedError?.category === "cloud_db_unavailable";

  const isSyncing = syncStatus === "syncing";

  const handleRetry = () => {
    setRetrying(true);
    onRetrySync();
    setTimeout(() => setRetrying(false), 2000);
  };

  const availableFeatures = [
    "Dashboard",
    "Processing",
    "Transactions",
    "Claim",
    "Profile",
    "Settings",
  ];
  const unavailableFeatures = [
    "Reports",
    "Staff Management",
    "Audit Logs",
    "Data Import",
  ];

  return (
    <div
      role="alert"
      className={cn(
        "mb-4 rounded-xl border p-3.5 text-xs shadow-sm transition-colors md:p-4 md:text-sm",
        isCloudOutage
          ? "border-rose-200 bg-rose-50/90 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100"
          : "border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Tier 1 Icon Differentiation: Red Database / AlertCircle vs Amber WifiOff */}
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            isCloudOutage
              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
          )}
        >
          {isCloudOutage ? (
            <Database className="h-4 w-4" />
          ) : isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2
                className={cn(
                  "font-bold leading-snug",
                  isCloudOutage
                    ? "text-rose-950 dark:text-rose-100"
                    : "text-amber-950 dark:text-amber-100",
                )}
              >
                {isCloudOutage
                  ? parsedError?.title || "Cloud Database Service Disruption"
                  : isSyncing
                    ? "Syncing Changes in Background"
                    : "Offline Mode — Working Locally"}
              </h2>
              <p
                className={cn(
                  "mt-0.5 leading-snug text-xs md:text-sm opacity-90",
                  isCloudOutage
                    ? "text-rose-900 dark:text-rose-200"
                    : "text-amber-900 dark:text-amber-200",
                )}
              >
                {isCloudOutage
                  ? parsedError?.message ||
                    "The cloud server is taking longer than expected to respond. All local operations remain available, and sync will resume automatically."
                  : isSyncing
                    ? "Queued changes are syncing with the server in the background."
                    : "No internet connection detected. Your changes are safely stored on this device and will automatically sync once your connection returns."}
              </p>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8 shrink-0 rounded-lg hover:bg-black/5 dark:hover:bg-white/5",
                isCloudOutage ? "text-rose-900 dark:text-rose-200" : "text-amber-900 dark:text-amber-200",
              )}
              onClick={onDismiss}
              aria-label="Dismiss notice"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Feature Availability Guides */}
          <div className="mt-3 space-y-2.5">
            <div>
              <p
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wider",
                  isCloudOutage ? "text-rose-800 dark:text-rose-300" : "text-amber-800 dark:text-amber-300",
                )}
              >
                Available now ({availableFeatures.length})
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {availableFeatures.map((feature) => (
                  <span
                    key={feature}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-xs font-medium shadow-2xs",
                      isCloudOutage
                        ? "border-rose-200 bg-white/80 text-rose-950 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-100"
                        : "border-amber-200 bg-white/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100",
                    )}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wider",
                  isCloudOutage ? "text-rose-800 dark:text-rose-300" : "text-amber-800 dark:text-amber-300",
                )}
              >
                {isCloudOutage ? "Needs cloud database" : "Needs internet connection"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {unavailableFeatures.map((feature) => (
                  <span
                    key={feature}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium",
                      isCloudOutage
                        ? "bg-rose-200/60 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200"
                        : "bg-amber-200/60 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
                    )}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Diagnostics and Action Bar */}
          <div className="mt-3.5 flex flex-col gap-2 pt-2 border-t border-current/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              {pendingChangesCount > 0 ? (
                <p className="font-semibold">
                  Pending changes waiting to sync: <span className="underline">{pendingChangesCount}</span>
                </p>
              ) : (
                <p className="text-xs opacity-80">
                  Data is safely cached locally and ready to sync.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-xs"
                onClick={onDismiss}
              >
                Dismiss
              </Button>
              {/* Interactive Retry Connection Button */}
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "h-8 gap-1.5 px-3 text-xs font-semibold cursor-pointer shadow-2xs",
                  isCloudOutage
                    ? "border-rose-300 bg-white/90 text-rose-950 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/80 dark:text-rose-100 dark:hover:bg-rose-900"
                    : "border-amber-300 bg-white/90 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100 dark:hover:bg-amber-900",
                )}
                onClick={handleRetry}
                disabled={retrying}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", retrying && "animate-spin")} />
                {retrying ? "Connecting…" : "Retry Connection"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
