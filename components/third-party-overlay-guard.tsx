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

        // Scan direct children of body for injected extension containers or scroll controls
        document.querySelectorAll("body > *").forEach((el) => {
          const id = el.id || "";
          const className = typeof el.className === "string" ? el.className : "";
          if (
            id === "__next" ||
            el.hasAttribute("data-radix-portal") ||
            el.hasAttribute("data-sonner-toaster") ||
            el.querySelector("#__next") ||
            el.tagName === "SCRIPT" ||
            el.tagName === "STYLE" ||
            el.tagName === "NEXTJS-PORTAL"
          ) {
            return;
          }

          // Check if id/class matches scroll or extension names
          if (
            /pratikabu|stt|scroll.*top|scroll.*btn|scroll.*arrow|top.*scroll/i.test(id) ||
            /pratikabu|stt|scroll.*top|scroll.*btn|scroll.*arrow|top.*scroll/i.test(className)
          ) {
            el.remove();
            return;
          }

          // Check if element contains ▲ or ▼ (standard scroll to top/bottom arrows)
          const text = el.textContent?.trim() || "";
          if ((text.includes("▲") || text.includes("▼")) && text.length < 20) {
            el.remove();
            return;
          }

          // Check computed style for fixed positioning along the right viewport edge
          if (window.getComputedStyle) {
            const style = window.getComputedStyle(el);
            if (
              style.position === "fixed" &&
              (style.right === "0px" || parseInt(style.right, 10) <= 30) &&
              !el.querySelector("nav, header, [role='dialog'], [role='menu']")
            ) {
              if (parseInt(style.width, 10) <= 80 || text.includes("▲") || text.includes("▼")) {
                el.remove();
                return;
              }
            }
          }

          if (el.shadowRoot) {
            const shadowMatches = el.shadowRoot.querySelectorAll(OVERLAY_SELECTORS);
            shadowMatches.forEach((sEl) => sEl.remove());
          }
        });

        // Check any button or floating control outside __next that has ▲ or ▼
        document.querySelectorAll("button, div[role='button']").forEach((btn) => {
          const appRoot = document.getElementById("__next");
          if (appRoot && appRoot.contains(btn)) {
            return;
          }
          const text = btn.textContent?.trim() || "";
          if ((text.includes("▲") || text.includes("▼")) && text.length <= 5) {
            const parent = btn.parentElement;
            if (parent && parent !== document.body && (!appRoot || !appRoot.contains(parent))) {
              parent.remove();
            } else {
              btn.remove();
            }
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
