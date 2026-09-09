import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("deduplicates tailwind conflicts via twMerge", () => {
    // twMerge should keep last conflicting class
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles conditional and falsy inputs", () => {
    expect(cn("base", false && "hidden", undefined, null, "active")).toBe("base active");
  });

  it("handles object syntax from clsx", () => {
    expect(cn({ "bg-red-500": true, "bg-blue-500": false })).toBe("bg-red-500");
  });

  it("handles arrays", () => {
    expect(cn(["px-2", "py-1"])).toBe("px-2 py-1");
  });
});
