const LAUNDRY_TIMEZONE = "Asia/Manila";

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getParts(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> | null {
  const date = toDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LAUNDRY_TIMEZONE,
    ...options,
  }).formatToParts(date);

  return parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
}

export function formatCompactDate(value: string | null | undefined): string {
  const parts = getParts(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  if (!parts) return "";
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatCompactDateTime(value: string | null | undefined): string {
  const parts = getParts(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  if (!parts) return "";
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatReadableDateTime(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: LAUNDRY_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatReadableDate(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: LAUNDRY_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
