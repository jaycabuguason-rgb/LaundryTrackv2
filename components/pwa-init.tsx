"use client";

import { useEffect, useMemo, useState } from "react";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
  }
}

const DISMISS_KEY = "laundrytrack-install-banner-dismissed";

export default function PwaInit() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isCompactMobile, setIsCompactMobile] = useState(false);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return displayModeStandalone || iosStandalone;
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isLocalhost =
      window.location.hostname === "localhost"
      || window.location.hostname === "127.0.0.1";
    const shouldRegister = process.env.NODE_ENV === "production" || isLocalhost;
    if (!shouldRegister) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    if (isStandalone) {
      return;
    }

    if (window.localStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const timer = window.setTimeout(() => {
      setVisible((current) => current || !isStandalone);
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, [isStandalone]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsCompactMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (!visible || isStandalone) {
    return null;
  }

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const triggerInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const iosHelp =
    typeof window !== "undefined"
      && /iPad|iPhone|iPod/.test(window.navigator.userAgent)
      && !("BeforeInstallPromptEvent" in window);

  return (
    <div
      className="fixed left-4 right-4 z-50 rounded-xl border border-border bg-card p-4 shadow-lg md:left-auto md:right-6 md:max-w-sm"
      style={{
        bottom: isCompactMobile
          ? "calc(env(safe-area-inset-bottom, 0px) + 68px)"
          : "1rem",
      }}
    >
      <p className="text-sm font-semibold text-foreground">Install LaundryTrack App</p>
      <p className="text-xs text-muted-foreground mt-1">
        {iosHelp
          ? "For iPhone/iPad: tap Share then Add to Home Screen."
          : "Install this app for faster access and better offline use."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {!iosHelp && deferredPrompt && (
          <button
            type="button"
            onClick={() => void triggerInstall()}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold"
          >
            Install App
          </button>
        )}
        {(!deferredPrompt || iosHelp) && (
          <button
            type="button"
            onClick={() => setShowHelp((value) => !value)}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold"
          >
            How to Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground"
        >
          Not now
        </button>
      </div>
      {showHelp && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Chrome/Edge: open browser menu then choose Install app or Add to Home screen. iPhone/iPad: Share then Add to Home Screen.
        </p>
      )}
    </div>
  );
}
