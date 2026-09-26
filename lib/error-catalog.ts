export type ErrorCategory =
  | "offline_network"
  | "cloud_db_unavailable"
  | "session_expired"
  | "validation_error"
  | "finalized_lock"
  | "file_upload_error"
  | "sync_conflict"
  | "duplicate_entry"
  | "general_error";

export interface ParsedAppError {
  category: ErrorCategory;
  title: string;
  message: string;
  actionLabel?: string;
  isRetryable: boolean;
  technicalDetails?: string;
}

/**
 * Categorizes and humanizes any error encountered in LaundryTrack.
 * Converts raw database codes, fetch rejections, and server errors into
 * clear, actionable, and friendly messages for laundry shop operators.
 */
export function parseAppError(error: unknown, fallbackMessage?: string): ParsedAppError {
  if (!error) {
    return {
      category: "general_error",
      title: "Notice",
      message: fallbackMessage || "An unexpected event occurred. Please try again.",
      isRetryable: true,
    };
  }

  // Extract raw message and codes
  let rawMessage = "";
  let errorCode: string | number | undefined;
  let errorDetails: string | undefined;

  if (typeof error === "string") {
    rawMessage = error;
  } else if (error instanceof Error) {
    rawMessage = error.message;
    if ("code" in error && typeof (error as Record<string, unknown>).code === "string") {
      errorCode = (error as Record<string, unknown>).code as string;
    }
  } else if (typeof error === "object") {
    const errObj = error as Record<string, unknown>;
    rawMessage = String(errObj.message || errObj.error || errObj.error_description || "");
    errorCode = (errObj.code || errObj.status || errObj.statusCode) as string | number | undefined;
    errorDetails = typeof errObj.details === "string" ? errObj.details : undefined;
  }

  const lowerMsg = rawMessage.toLowerCase();
  const lowerCode = String(errorCode || "").toLowerCase();

  // 1. Cloud Database / Server Outage
  if (
    lowerCode === "500" ||
    lowerCode === "502" ||
    lowerCode === "503" ||
    lowerCode === "504" ||
    lowerMsg.includes("database offline") ||
    lowerMsg.includes("supabase offline") ||
    lowerMsg.includes("internal server error") ||
    lowerMsg.includes("bad gateway") ||
    lowerMsg.includes("service unavailable") ||
    lowerMsg.includes("gateway timeout") ||
    lowerMsg.includes("paused project")
  ) {
    return {
      category: "cloud_db_unavailable",
      title: "Cloud Database Temporarily Unreachable",
      message:
        "The cloud server is taking longer than expected to respond. All local operations remain available, and sync will resume automatically.",
      actionLabel: "Check Status",
      isRetryable: true,
      technicalDetails: rawMessage,
    };
  }

  // 2. Offline & Network Errors
  if (
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    lowerMsg.includes("failed to fetch") ||
    lowerMsg.includes("networkerror") ||
    lowerMsg.includes("net::err") ||
    lowerMsg.includes("network request failed") ||
    lowerMsg.includes("offline") ||
    lowerMsg.includes("internet disconnected") ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("etimedout")
  ) {
    return {
      category: "offline_network",
      title: "Offline — Saved to Device",
      message:
        "No internet connection detected. Your changes are safely stored on this device and will automatically sync once your connection is back.",
      actionLabel: "Retry Sync",
      isRetryable: true,
      technicalDetails: rawMessage,
    };
  }

  // 2. Session & Authentication Errors
  if (
    lowerMsg.includes("jwt expired") ||
    lowerMsg.includes("invalid refresh token") ||
    lowerMsg.includes("session expired") ||
    lowerMsg.includes("not authenticated") ||
    lowerMsg.includes("unauthorized") ||
    lowerCode === "401" ||
    lowerCode === "pgrst301" ||
    lowerMsg.includes("user not found")
  ) {
    return {
      category: "session_expired",
      title: "Session Expired",
      message:
        "Your secure session has timed out. Please sign in again to sync transactions and manage staff accounts.",
      actionLabel: "Sign In",
      isRetryable: false,
      technicalDetails: rawMessage,
    };
  }

  // 3. Duplicate Records
  if (
    lowerCode === "23505" ||
    lowerMsg.includes("already exists") ||
    lowerMsg.includes("duplicate key") ||
    lowerMsg.includes("unique constraint") ||
    lowerMsg.includes("duplicate ticket")
  ) {
    return {
      category: "duplicate_entry",
      title: "Duplicate Record Detected",
      message:
        "A record with this identifier already exists in the system. Please verify the customer phone or ticket number.",
      actionLabel: "Review Input",
      isRetryable: false,
      technicalDetails: rawMessage,
    };
  }

  // 4. Finalized / Locked Records
  if (
    lowerMsg.includes("claimed") && (lowerMsg.includes("cannot be modified") || lowerMsg.includes("locked")) ||
    lowerMsg.includes("voided") && (lowerMsg.includes("cannot be modified") || lowerMsg.includes("locked")) ||
    lowerMsg.includes("record is finalized") ||
    lowerMsg.includes("cannot be reverted")
  ) {
    return {
      category: "finalized_lock",
      title: "Record Finalized",
      message:
        "This transaction is completed and locked against accidental edits. Counter transactions marked as Claimed or Voided are permanently archived.",
      actionLabel: "View Details",
      isRetryable: false,
      technicalDetails: rawMessage,
    };
  }

  // 5. File Upload Errors
  if (
    lowerMsg.includes("upload") ||
    lowerMsg.includes("image") && (lowerMsg.includes("size") || lowerMsg.includes("large") || lowerMsg.includes("format")) ||
    lowerMsg.includes("file too large") ||
    lowerMsg.includes("unsupported file type") ||
    lowerMsg.includes("storage")
  ) {
    return {
      category: "file_upload_error",
      title: "Upload Unsuccessful",
      message:
        "The photo could not be uploaded. Please choose a JPEG, PNG, or WebP image under 2MB.",
      actionLabel: "Choose Photo",
      isRetryable: true,
      technicalDetails: rawMessage,
    };
  }


  // 7. Validation / Input Errors
  if (
    lowerMsg.includes("required") ||
    lowerMsg.includes("invalid") ||
    lowerMsg.includes("must be") ||
    lowerMsg.includes("cannot be empty") ||
    lowerCode === "23502" ||
    lowerCode === "23514"
  ) {
    return {
      category: "validation_error",
      title: "Information Needed",
      message: rawMessage || fallbackMessage || "Please check your inputs and try again.",
      actionLabel: "Fix Input",
      isRetryable: false,
      technicalDetails: errorDetails || rawMessage,
    };
  }

  // 8. Sync Conflicts
  if (
    lowerMsg.includes("conflict") ||
    lowerMsg.includes("version mismatch") ||
    lowerMsg.includes("modified by another user")
  ) {
    return {
      category: "sync_conflict",
      title: "Update Conflict Resolved",
      message:
        "Another terminal updated this record recently. The view has been refreshed with the most up-to-date data.",
      actionLabel: "Refresh",
      isRetryable: true,
      technicalDetails: rawMessage,
    };
  }

  // General Fallback
  return {
    category: "general_error",
    title: "Something Went Wrong",
    message:
      fallbackMessage ||
      (rawMessage.length > 0 && rawMessage.length < 120
        ? rawMessage
        : "An unexpected error occurred. Please try again or refresh the page."),
    actionLabel: "Try Again",
    isRetryable: true,
    technicalDetails: rawMessage,
  };
}
