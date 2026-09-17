const LAUNDRY_TIMEZONE = "Asia/Manila";

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  let normalized = value;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) {
    normalized = value.replace(" ", "T");
  }
  const date = new Date(normalized);
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
    hour12: true,
  }).format(date);
}

export function formatReadableTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? toDate(value) : value;
  if (!date || Number.isNaN(date.getTime())) {
    if (typeof value === "string") {
      const match = value.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        let hour = parseInt(match[1], 10);
        const min = match[2];
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
        return `${hour}:${min} ${ampm}`;
      }
    }
    return typeof value === "string" ? value : "";
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: LAUNDRY_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
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
