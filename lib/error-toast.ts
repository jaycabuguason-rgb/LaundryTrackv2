import { toast } from "@/hooks/use-toast";
import { parseAppError, type ParsedAppError } from "./error-catalog";

export interface ShowAppErrorOptions {
  fallbackMessage?: string;
  onRetry?: () => void;
}

/**
 * Standardized error toast that humanizes any error, provides clear next steps,
 * and avoids displaying cryptic raw technical stack traces or confusing "database offline" notices.
 */
export function showAppErrorToast(error: unknown, options?: ShowAppErrorOptions): ParsedAppError {
  const parsed = parseAppError(error, options?.fallbackMessage);

  toast({
    title: parsed.title,
    description: parsed.message,
    variant: "destructive",
  });

  return parsed;
}
