"use client";

import { useState, useEffect } from "react";
import { Cloud, CloudOff, Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSettingsQueueCount } from "@/lib/offline-settings-sync";
import { readOfflineQueue } from "@/lib/offline-transactions";
import { isOnline } from "@/lib/network-status";

interface SyncStatusDetailProps {
  onRetrySync?: () => void;
}

export default function SyncStatusDetail({ onRetrySync }: SyncStatusDetailProps) {
  const [online, setOnline] = useState(true);
  const [settingsCount, setSettingsCount] = useState(0);
  const [transactionsCount, setTransactionsCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const updateCounts = async () => {
      setOnline(isOnline());
      setSettingsCount(getSettingsQueueCount());
      const txnQueue = await readOfflineQueue();
      setTransactionsCount(txnQueue.length);
    };

    void updateCounts();

    const interval = setInterval(() => {
      void updateCounts();
    }, 2000);

    const handleOnline = () => {
      setOnline(true);
      void updateCounts();
    };

    const handleOffline = () => {
      setOnline(false);
      void updateCounts();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const totalPending = settingsCount + transactionsCount;

  const handleRetry = () => {
    setSyncing(true);
    onRetrySync?.();
    setTimeout(() => setSyncing(false), 2000);
  };

  if (online && totalPending === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900">All Synced</p>
              <p className="text-xs text-green-700">All changes are saved to the cloud</p>
            </div>
            <Cloud className="w-5 h-5 text-green-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!online) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <CloudOff className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-900">Offline Mode</p>
              <p className="text-xs text-orange-700">
                {totalPending > 0
                  ? `${totalPending} change${totalPending === 1 ? "" : "s"} pending sync`
                  : "Working offline"}
              </p>
            </div>
            {totalPending > 0 && (
              <Badge variant="secondary" className="bg-orange-200 text-orange-900">
                {totalPending}
              </Badge>
            )}
          </div>
          {totalPending > 0 && (
            <div className="mt-3 pt-3 border-t border-orange-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-orange-700">Transactions:</span>
                <span className="font-semibold text-orange-900">{transactionsCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-orange-700">Settings:</span>
                <span className="font-semibold text-orange-900">{settingsCount}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            {syncing ? (
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            ) : (
              <AlertCircle className="w-5 h-5 text-blue-600" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900">
              {syncing ? "Syncing..." : "Pending Changes"}
            </p>
            <p className="text-xs text-blue-700">
              {totalPending} change{totalPending === 1 ? "" : "s"} waiting to sync
            </p>
          </div>
          <Badge variant="secondary" className="bg-blue-200 text-blue-900">
            {totalPending}
          </Badge>
        </div>
        <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-700">Transactions:</span>
            <span className="font-semibold text-blue-900">{transactionsCount}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-700">Settings:</span>
            <span className="font-semibold text-blue-900">{settingsCount}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 gap-2 border-blue-300 text-blue-700 hover:bg-blue-100"
            onClick={handleRetry}
            disabled={syncing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Retry Sync Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
