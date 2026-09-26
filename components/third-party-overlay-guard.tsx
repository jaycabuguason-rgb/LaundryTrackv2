"use client";

import { useEffect } from "react";

const OVERLAY_SELECTORS = [
  "#pratikabuSTTDiv",
  "#pratikabuSTTDiv2",
  '[id^="pratikabuSTT"]',
  '[class^="pratikabuSTT"]',
  "#scroll-to-top",
  ".scroll-to-top",
  ".scroll-to-top-button",
  "#scroll-to-top-button",
  "#stt-container",
  ".stt-button",
  "[data-stt]",
  "[data-scroll-to-top]",
].join(", ");

export default function ThirdPartyOverlayGuard() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const cleanOverlays = () => {
      try {
        const elements = document.querySelectorAll(OVERLAY_SELECTORS);
        elements.forEach((el) => {
          el.remove();
        });
      } catch {
        // Silently ignore if query selector fails or DOM is in transient state
      }
    };

    cleanOverlays();

    const observer = new MutationObserver(() => {
      cleanOverlays();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
