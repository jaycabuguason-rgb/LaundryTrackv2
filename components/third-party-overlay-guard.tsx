"use client";

import { useEffect } from "react";

const OVERLAY_SELECTORS = [
  "#pratikabuSTTDiv",
  "#pratikabuSTTDiv2",
  '[id*="pratikabu" i]',
  '[class*="pratikabu" i]',
  '[id^="pratikabuSTT" i]',
  '[class^="pratikabuSTT" i]',
  "#scroll-to-top",
  ".scroll-to-top",
  ".scroll-to-top-button",
  "#scroll-to-top-button",
  "#stt-container",
  ".stt-button",
  "[data-stt]",
  "[data-scroll-to-top]",
  '[id*="scrolltop" i]',
  '[class*="scrolltop" i]',
  '[id*="scroll-top" i]',
  '[class*="scroll-top" i]',
  '[id*="stt" i]',
  '[class*="stt" i]',
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

        // Check direct children of body/html for custom elements or injected extension containers
        document.querySelectorAll("body > *").forEach((el) => {
          const id = el.id || "";
          const className = typeof el.className === "string" ? el.className : "";
          if (
            (id && /pratikabu|stt|scroll.*top/i.test(id)) ||
            (className && /pratikabu|stt|scroll.*top/i.test(className))
          ) {
            if (id !== "__next" && !el.hasAttribute("data-radix-portal") && !el.querySelector("#__next")) {
              el.remove();
            }
          }
          if (el.shadowRoot) {
            const shadowMatches = el.shadowRoot.querySelectorAll(OVERLAY_SELECTORS);
            shadowMatches.forEach((sEl) => sEl.remove());
          }
        });
      } catch {
        // Silently ignore transient DOM errors
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

    window.addEventListener("scroll", cleanOverlays, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", cleanOverlays);
    };
  }, []);

  return null;
}
