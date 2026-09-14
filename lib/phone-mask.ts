/**
 * Masks a phone number for receipt printing and customer-facing slips:
 * For Philippine 11-digit numbers (e.g., 09171234567):
 * Shows the first 2 digits (09), masks the middle 6 digits with asterisks (******),
 * and shows the last 3 digits (567) -> "09******567".
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== "string") return "—";
  const trimmed = phone.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-") return "—";

  // Normalize: extract digits
  let digits = trimmed.replace(/\D/g, "");

  // Convert international +639XXXXXXXXX (12 digits) to standard PH 09XXXXXXXXX
  if (digits.startsWith("63") && digits.length === 12) {
    digits = "0" + digits.slice(2);
  }

  // Standard 11-digit PH mobile number: 2 digits + 6 asterisks + 3 digits
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}******${digits.slice(-3)}`;
  }

  // Handle other digit lengths with at least 5 digits
  if (digits.length >= 5) {
    const maskLen = digits.length - 5;
    return `${digits.slice(0, 2)}${"*".repeat(maskLen)}${digits.slice(-3)}`;
  }

  // For very short numbers, mask middle or return safely
  if (digits.length > 2) {
    return `${digits.slice(0, 1)}${"*".repeat(digits.length - 2)}${digits.slice(-1)}`;
  }

  return trimmed;
}
