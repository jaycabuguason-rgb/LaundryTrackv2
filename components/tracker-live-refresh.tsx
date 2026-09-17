"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

interface TrackerLiveRefreshProps {
  status: string;
}

const ACTIVE_STATUSES = ["Received", "Washing", "Ready"];

export function TrackerLiveRefresh({ status }: TrackerLiveRefreshProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());

  const isActive = ACTIVE_STATUSES.includes(status);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setIsRefreshing(true);
      router.refresh();
      setLastRefreshed(new Date());
      setTimeout(() => setIsRefreshing(false), 800);
    }, 20000);

    return () => clearInterval(interval);
  }, [isActive, router]);

  if (!isActive) return null;

  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span>Live tracking active</span>
      <span className="text-muted-foreground/40">•</span>
      <span className="tabular-nums text-[11px]">
        Updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
      </span>
      {isRefreshing && (
        <RefreshCw className="w-3 h-3 animate-spin text-primary ml-0.5" aria-label="Refreshing status…" />
      )}
    </div>
  );
}
