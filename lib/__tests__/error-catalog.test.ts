import { describe, it, expect } from "vitest";
import { parseAppError } from "../error-catalog";

describe("Error Catalog & Humanized Error Parser", () => {
  it("categorizes offline and network errors with friendly title and advice", () => {
    const fetchErr = new Error("TypeError: Failed to fetch");
    const parsed = parseAppError(fetchErr);

    expect(parsed.category).toBe("offline_network");
    expect(parsed.title).toBe("Offline — Saved to Device");
    expect(parsed.message).toContain("No internet connection detected");
    expect(parsed.isRetryable).toBe(true);
  });

  it("categorizes session expiry and auth errors", () => {
    const authErr = { message: "JWT expired", code: 401 };
    const parsed = parseAppError(authErr);

    expect(parsed.category).toBe("session_expired");
    expect(parsed.title).toBe("Session Expired");
    expect(parsed.message).toContain("Please sign in again");
  });

  it("categorizes duplicate record errors (Postgres code 23505)", () => {
    const dupErr = { message: "duplicate key value violates unique constraint", code: "23505" };
    const parsed = parseAppError(dupErr);

    expect(parsed.category).toBe("duplicate_entry");
    expect(parsed.title).toBe("Duplicate Record Detected");
    expect(parsed.message).toContain("already exists");
  });

  it("categorizes finalized or locked ticket errors", () => {
    const lockErr = new Error("This ticket is claimed and cannot be modified.");
    const parsed = parseAppError(lockErr);

    expect(parsed.category).toBe("finalized_lock");
    expect(parsed.title).toBe("Record Finalized");
    expect(parsed.message).toContain("completed and locked");
  });

  it("categorizes file upload errors", () => {
    const uploadErr = new Error("Avatar upload failed: file too large");
    const parsed = parseAppError(uploadErr);

    expect(parsed.category).toBe("file_upload_error");
    expect(parsed.title).toBe("Upload Unsuccessful");
    expect(parsed.message).toContain("2MB");
  });

  it("categorizes cloud database outages and 503s", () => {
    const dbErr = { message: "database offline or unreachable", code: "503" };
    const parsed = parseAppError(dbErr);

    expect(parsed.category).toBe("cloud_db_unavailable");
    expect(parsed.title).toBe("Cloud Database Temporarily Unreachable");
    expect(parsed.message).toContain("cloud server is taking longer than expected");
    expect(parsed.isRetryable).toBe(true);
  });

  it("categorizes validation errors", () => {
    const valErr = new Error("Customer name is required and cannot be empty");
    const parsed = parseAppError(valErr);

    expect(parsed.category).toBe("validation_error");
    expect(parsed.title).toBe("Information Needed");
  });

  it("categorizes sync conflicts", () => {
    const conflictErr = new Error("Record modified by another user on another device");
    const parsed = parseAppError(conflictErr);

    expect(parsed.category).toBe("sync_conflict");
    expect(parsed.title).toBe("Update Conflict Resolved");
  });

  it("handles empty or null errors with fallback message", () => {
    const parsed = parseAppError(null, "Custom fallback");
    expect(parsed.category).toBe("general_error");
    expect(parsed.message).toBe("Custom fallback");
  });
});
