"use client";

import { WifiOff, RefreshCw, Home, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-redirect to home when back online
      setTimeout(() => router.push("/"), 1000);
    };

    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-orange-600" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-lg font-semibold text-foreground">
              {isOnline ? "Back Online!" : "You're Offline"}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isOnline
                ? "Your connection has been restored. Redirecting..."
                : "LaundryTrack is still usable for cached pages and offline-enabled features. Reconnect to sync pending changes."}
            </p>
          </div>

          {!isOnline && (
            <div className="pt-2 space-y-2">
              <Button
                onClick={() => window.location.reload()}
                className="w-full gap-2"
                variant="default"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Connection
              </Button>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  className="gap-2"
                >
                  <Home className="w-4 h-4" />
                  Dashboard
                </Button>
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  className="gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Transactions
                </Button>
              </div>
            </div>
          )}
        </div>

        {!isOnline && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800 space-y-2">
            <p className="font-semibold">Offline Features Available:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>View cached transactions</li>
              <li>Create new transactions (will sync when online)</li>
              <li>Update transaction status</li>
              <li>Modify settings (changes queued for sync)</li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
