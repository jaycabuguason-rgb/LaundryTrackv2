import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import ThirdPartyOverlayGuard from "@/components/third-party-overlay-guard";

describe("ThirdPartyOverlayGuard", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.querySelectorAll('[id^="pratikabuSTT"], #scroll-to-top').forEach((el) => el.remove());
  });

  it("removes existing injected third-party scroll-to-top overlays on mount", () => {
    const injected = document.createElement("div");
    injected.id = "pratikabuSTTDiv";
    document.body.appendChild(injected);

    expect(document.getElementById("pratikabuSTTDiv")).not.toBeNull();

    render(<ThirdPartyOverlayGuard />, { container });

    expect(document.getElementById("pratikabuSTTDiv")).toBeNull();
  });

  it("removes dynamically injected overlays after mount via MutationObserver", async () => {
    render(<ThirdPartyOverlayGuard />, { container });

    const dynamicOverlay = document.createElement("div");
    dynamicOverlay.id = "pratikabuSTTDiv2";

    await act(async () => {
      document.body.appendChild(dynamicOverlay);
    });

    expect(document.getElementById("pratikabuSTTDiv2")).toBeNull();
  });
});
