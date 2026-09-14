import { describe, it, expect } from "vitest";
import { cn, getUserInitials } from "@/lib/utils";

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

describe("getUserInitials", () => {
  it("extracts first and second name initials from full name", () => {
    expect(getUserInitials("Jay Cabuguason")).toBe("JC");
    expect(getUserInitials("Maria Santos Dela Cruz")).toBe("MS");
    expect(getUserInitials("John Doe")).toBe("JD");
  });

  it("extracts first and second parts when name is CamelCase or PascalCase", () => {
    expect(getUserInitials("JayCabuguason")).toBe("JC");
  });

  it("extracts initials when username has first and second parts or delimiters", () => {
    expect(getUserInitials(null, "jay_cabuguason")).toBe("JC");
    expect(getUserInitials(null, "jay.cabuguason")).toBe("JC");
    expect(getUserInitials(null, "jay cabuguason")).toBe("JC");
    expect(getUserInitials(null, "JayCabuguason")).toBe("JC");
  });

  it("handles single name combined with username", () => {
    expect(getUserInitials("Jay", "jay_cabuguason")).toBe("JC");
  });

  it("handles single name fallback to 2 characters", () => {
    expect(getUserInitials("Admin")).toBe("AD");
    expect(getUserInitials("J")).toBe("J");
  });

  it("falls back to email prefix initials or default LT", () => {
    expect(getUserInitials(null, null, "jay.cabuguason@example.com")).toBe("JC");
    expect(getUserInitials(null, null, "admin@example.com")).toBe("AD");
    expect(getUserInitials(null, null, null)).toBe("LT");
  });
});
