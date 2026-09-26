import React from "react";
import {
  WifiOff,
  Database,
  Lock,
  AlertTriangle,
  UploadCloud,
  RefreshCw,
  FileWarning,
  CopyX,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { parseAppError, type ParsedAppError, type ErrorCategory } from "./error-catalog";

export interface ShowAppErrorOptions {
  fallbackMessage?: string;
  actionLabel?: string;
  onAction?: () => void;
  onRetry?: () => void;
}

/**
 * Returns an appropriate React icon component for an error category.
 */
export function getErrorCategoryIcon(category: ErrorCategory, className = "w-4 h-4 shrink-0 text-current"): React.ReactNode {
  switch (category) {
    case "offline_network":
      return React.createElement(WifiOff, { className });
    case "cloud_db_unavailable":
      return React.createElement(Database, { className });
    case "session_expired":
    case "finalized_lock":
      return React.createElement(Lock, { className });
    case "file_upload_error":
      return React.createElement(UploadCloud, { className });
    case "sync_conflict":
      return React.createElement(RefreshCw, { className });
    case "duplicate_entry":
      return React.createElement(CopyX, { className });
    case "validation_error":
      return React.createElement(FileWarning, { className });
    default:
      return React.createElement(AlertTriangle, { className });
  }
}

/**
 * Standardized Tier 2 enhanced action toast:
 * - Maps error category to visual category icons
 * - Bold friendly titles and plain-English explanations
 * - Direct action CTAs (e.g. "Retry Now", "Sign In Again", custom actions)
 */
export function showAppErrorToast(error: unknown, options?: ShowAppErrorOptions): ParsedAppError {
  const parsed = parseAppError(error, options?.fallbackMessage);
  const icon = getErrorCategoryIcon(parsed.category, "w-4 h-4 shrink-0 inline-block mr-1.5");

  const actionHandler = options?.onAction || options?.onRetry;
  const actionText = options?.actionLabel || (options?.onRetry ? "Retry Now" : parsed.actionLabel);

  const actionElement = actionHandler && actionText
    ? (React.createElement(
        ToastAction,
        {
          altText: actionText,
          onClick: actionHandler,
          className: "cursor-pointer font-semibold",
        },
        actionText,
      ) as unknown as ToastActionElement)
    : undefined;

  const titleElement: React.ReactNode = React.createElement(
    "span",
    { className: "flex items-center gap-1.5 font-bold" },
    icon,
    React.createElement("span", null, parsed.title),
  );

  toast({
    title: titleElement as unknown as string,
    description: parsed.message,
    action: actionElement,
    variant: "destructive",
  });

  return parsed;
}
