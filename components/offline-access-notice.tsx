"use client";

import { useMemo } from "react";
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

  const availableFeatures =
    "Dashboard, Processing, Transactions, Claim Verification, Profile, Settings (Pricing / Business Profile / Loyalty)";
  const unavailableFeatures = "Reports, Staff Management, Audit Logs, Data Import";

  return (
    <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs md:text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-orange-900">
          {stateLabel} Mode: some features are limited while {statusMessage}
        </p>
        <div className="flex items-center gap-2">
          {pendingChangesCount > 0 && syncStatus !== "syncing" && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRetrySync}>
              Retry Sync
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-orange-900" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
      <p className="mt-2 text-orange-900">
        <span className="font-semibold">Available now:</span> {availableFeatures}
      </p>
      <p className="mt-1 text-orange-900">
        <span className="font-semibold">Unavailable until online:</span> {unavailableFeatures}
      </p>
      {pendingChangesCount > 0 && (
        <p className="mt-1 text-orange-900">
          <span className="font-semibold">Pending changes:</span> {pendingChangesCount}
        </p>
      )}
      {lastSyncError && syncStatus === "error" && (
        <p className="mt-1 text-red-700">
          <span className="font-semibold">Sync error:</span> {lastSyncError}
        </p>
      )}
    </div>
  );
}
