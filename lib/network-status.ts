"use client";

export function isOnline(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.navigator.onLine;
}

export function subscribeNetworkStatus(callback: (online: boolean) => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const emitOnline = () => callback(true);
  const emitOffline = () => callback(false);

  window.addEventListener("online", emitOnline);
  window.addEventListener("offline", emitOffline);

  return () => {
    window.removeEventListener("online", emitOnline);
    window.removeEventListener("offline", emitOffline);
  };
}
