"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CameraOff, CheckCircle2 } from "lucide-react";
import jsQR from "jsqr";
import { playScanSuccessFeedback } from "@/lib/scanner-feedback";
import { cn } from "@/lib/utils";

interface QRScannerProps {
  onScan: (value: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const videoRef   = useRef<HTMLVideoElement | null>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);
  const [scannedSuccess, setScannedSuccess] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const normalizeScannedValue = useCallback((raw: string) => {
    const ticketMatch = raw.match(/ticket\/([A-Z0-9-]+)/i);
    const trackMatch = raw.match(/track\/([a-z0-9]+)/i);

    return ticketMatch
      ? ticketMatch[1].toUpperCase()
      : trackMatch
        ? trackMatch[1].toLowerCase()
        : raw;
  }, []);

  const stopScanner = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);

      const BD = (window as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => {
          detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
        };
      }).BarcodeDetector;
      const detector = BD ? new BD({ formats: ["qr_code"] }) : null;

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        try {
          if (detector) {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) {
              setScannedSuccess(true);
              playScanSuccessFeedback();
              onScan(normalizeScannedValue(results[0].rawValue));
              setTimeout(() => {
                stopScanner();
                setScannedSuccess(false);
              }, 250);
              return;
            }
          } else if (canvasRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
            const canvas = canvasRef.current;
            const context = canvas.getContext("2d", { willReadFrequently: true });

            if (context) {
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const image = context.getImageData(0, 0, canvas.width, canvas.height);
              const result = jsQR(image.data, image.width, image.height, {
                inversionAttempts: "dontInvert",
              });

              if (result?.data) {
                setScannedSuccess(true);
                playScanSuccessFeedback();
                onScan(normalizeScannedValue(result.data));
                setTimeout(() => {
                  stopScanner();
                  setScannedSuccess(false);
                }, 250);
                return;
              }
            }
          }
        } catch { /* continue scanning */ }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")
          ? "Camera permission denied. Please allow camera access and try again."
          : msg.toLowerCase().includes("secure context")
            ? "Camera needs a secure page. Use localhost or HTTPS and try again."
          : "Could not start camera. Check your device and browser permissions."
      );
    }
  }, [normalizeScannedValue, onScan, stopScanner]);

  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  return (
    <div className="space-y-3">
      {/* Scanner viewport */}
      <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Live camera viewfinder for QR scanning"
          className="w-full h-full object-cover"
        />
        {/* Hidden canvas used if needed */}
        <canvas ref={canvasRef} className="hidden" />

        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/60 backdrop-blur-sm">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CameraOff className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Camera is off</p>
          </div>
        )}

        {/* Corner guides when active */}
        {active && (
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-0 flex items-center justify-center pointer-events-none transition-colors duration-200",
              scannedSuccess && "bg-emerald-500/20"
            )}
          >
            <div className="relative w-48 h-48">
              <span className={cn("absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 rounded-tl-sm transition-colors duration-200", scannedSuccess ? "border-emerald-400" : "border-white")} />
              <span className={cn("absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 rounded-tr-sm transition-colors duration-200", scannedSuccess ? "border-emerald-400" : "border-white")} />
              <span className={cn("absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 rounded-bl-sm transition-colors duration-200", scannedSuccess ? "border-emerald-400" : "border-white")} />
              <span className={cn("absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 rounded-br-sm transition-colors duration-200", scannedSuccess ? "border-emerald-400" : "border-white")} />
              {scannedSuccess && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-in zoom-in-75 duration-150" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      <Button
        size="sm"
        variant={active ? "destructive" : "default"}
        className="w-full min-h-[44px]"
        onClick={active ? stopScanner : startScanner}
      >
        {active ? "Stop Camera" : "Start Camera"}
      </Button>

      {active && (
        <p className="text-xs text-center text-muted-foreground">
          Point the QR code at the camera to scan automatically.
        </p>
      )}
    </div>
  );
}
