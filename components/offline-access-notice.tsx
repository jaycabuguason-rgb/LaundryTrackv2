"use client";

import { useMemo } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const stateLabel = useMemo(() => {
    if (syncStatus === "syncing") {
      return "Syncing";
    }
    if (syncStatus === "error") {
      return "Sync Error";
    }
    return "Offline";
  }, [syncStatus]);

  const statusMessage = useMemo(() => {
    if (syncStatus === "syncing") {
      return "changes are being synced in the background.";
    }
    if (syncStatus === "error") {
      return "we could not sync some data to the server.";
    }
    return "internet is unavailable.";
  }, [syncStatus]);

  const availableFeatures = ["Dashboard", "Processing", "Transactions", "Claim", "Profile", "Settings"];
  const unavailableFeatures = ["Reports", "Staff", "Audit Logs", "Data Import"];

  return (
    <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-950 shadow-sm md:p-4 md:text-sm">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-orange-950">{stateLabel} Mode</p>
              <p className="mt-0.5 leading-snug text-orange-900">
                Some features are limited while {statusMessage}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-orange-900 hover:bg-orange-100"
              onClick={onDismiss}
              aria-label="Dismiss offline notice"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-800">Available now</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {availableFeatures.map((feature) => (
                  <span key={feature} className="rounded-full border border-orange-200 bg-white/70 px-2 py-1 text-[11px] font-medium text-orange-950">
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-800">Needs internet</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {unavailableFeatures.map((feature) => (
                  <span key={feature} className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-medium text-orange-900">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              {pendingChangesCount > 0 && (
                <p className="text-orange-900">
                  <span className="font-semibold">Pending changes:</span> {pendingChangesCount}
                </p>
              )}
              {lastSyncError && syncStatus === "error" && (
                <p className="text-red-700">
                  <span className="font-semibold">Sync error:</span> {lastSyncError}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="h-9 flex-1 px-3 text-xs text-orange-900 hover:bg-orange-100 sm:flex-none" onClick={onDismiss}>
                Dismiss
              </Button>
              {pendingChangesCount > 0 && syncStatus !== "syncing" && (
                <Button size="sm" variant="outline" className="h-9 flex-1 gap-1.5 border-orange-300 bg-white/70 text-xs text-orange-950 hover:bg-orange-100 sm:flex-none" onClick={onRetrySync}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
