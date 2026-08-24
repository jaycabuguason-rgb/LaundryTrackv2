"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CameraOff } from "lucide-react";
import jsQR from "jsqr";

interface QRScannerProps {
  onScan: (value: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const videoRef   = useRef<HTMLVideoElement | null>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);
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
              onScan(normalizeScannedValue(results[0].rawValue));
              stopScanner();
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
                onScan(normalizeScannedValue(result.data));
                stopScanner();
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-48 h-48">
              <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-sm" />
              <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-sm" />
              <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-sm" />
              <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-sm" />
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
