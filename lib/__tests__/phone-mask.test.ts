import { describe, it, expect } from "vitest";
import { maskPhoneNumber } from "@/lib/phone-mask";

describe("maskPhoneNumber", () => {
  it("masks standard 11-digit Philippine mobile number", () => {
    expect(maskPhoneNumber("09171234567")).toBe("09******567");
    expect(maskPhoneNumber("09987654321")).toBe("09******321");
    expect(maskPhoneNumber("09123456789")).toBe("09******789");
  });

  it("masks numbers with spaces, dashes, or formatting", () => {
    expect(maskPhoneNumber("0917-123-4567")).toBe("09******567");
    expect(maskPhoneNumber("0917 123 4567")).toBe("09******567");
    expect(maskPhoneNumber("(0917) 123-4567")).toBe("09******567");
  });

  it("handles international +63 Philippine mobile numbers", () => {
    expect(maskPhoneNumber("+639171234567")).toBe("09******567");
    expect(maskPhoneNumber("639171234567")).toBe("09******567");
    expect(maskPhoneNumber("+63 917 123 4567")).toBe("09******567");
  });

  it("handles other lengths with at least 5 digits", () => {
    // 7 digit landline
    expect(maskPhoneNumber("8123456")).toBe("81**456");
    // 10 digit number
    expect(maskPhoneNumber("0212345678")).toBe("02*****678");
  });

  it("handles empty or invalid values safely", () => {
    expect(maskPhoneNumber("")).toBe("—");
    expect(maskPhoneNumber("   ")).toBe("—");
    expect(maskPhoneNumber("—")).toBe("—");
    expect(maskPhoneNumber(null)).toBe("—");
    expect(maskPhoneNumber(undefined)).toBe("—");
  });
});
