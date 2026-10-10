import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OfflineAccessNotice from "@/components/offline-access-notice";
import { ConnectionDiagnosticsDialog } from "@/components/connection-diagnostics-dialog";
import TopNav from "@/components/topnav";
import { showAppErrorToast } from "@/lib/error-toast";
import { toast } from "@/hooks/use-toast";
import { TransactionEditModal } from "@/components/transaction-edit-modal";
import type { Transaction } from "@/lib/data";

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("Tier 1: Global Notice Banner (OfflineAccessNotice)", () => {
  it("renders amber styling and offline messaging for pure internet disconnect", () => {
    const onRetrySync = vi.fn();
    const onDismiss = vi.fn();

    const { container } = render(
      <OfflineAccessNotice
        syncStatus="offline"
        pendingChangesCount={2}
        lastSyncError={null}
        onRetrySync={onRetrySync}
        onDismiss={onDismiss}
      />
    );

    // Banner heading and content
    expect(screen.getByText(/Offline Mode — Working Locally/i)).toBeInTheDocument();
    expect(screen.getByText(/No internet connection detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending changes waiting to sync:/i)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // Check amber background styling
    const alertBox = container.querySelector('[role="alert"]');
    expect(alertBox?.className).toContain("bg-amber-50");

    // Interactive Retry Connection button
    const retryBtn = screen.getByRole("button", { name: /Retry Connection/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetrySync).toHaveBeenCalledTimes(1);

    // Dismiss button
    const dismissBtn = screen.getByRole("button", { name: /Dismiss notice/i });
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders red styling and cloud database disruption messaging for cloud outage", () => {
    const onRetrySync = vi.fn();
    const onDismiss = vi.fn();

    const { container } = render(
      <OfflineAccessNotice
        syncStatus="error"
        pendingChangesCount={0}
        lastSyncError="database offline or 503 service unavailable"
        onRetrySync={onRetrySync}
        onDismiss={onDismiss}
      />
    );

    // Banner heading and content
    expect(screen.getByText(/Cloud Database Temporarily Unreachable/i)).toBeInTheDocument();
    expect(screen.getByText(/cloud server is taking longer than expected/i)).toBeInTheDocument();

    // Check red background styling
    const alertBox = container.querySelector('[role="alert"]');
    expect(alertBox?.className).toContain("bg-rose-50");

    // Retry button is available and functional
    const retryBtn = screen.getByRole("button", { name: /Retry Connection/i });
    fireEvent.click(retryBtn);
    expect(onRetrySync).toHaveBeenCalledTimes(1);
  });

  it("renders role-tailored counter features and hides admin-only restrictions for staff", () => {
    const onRetrySync = vi.fn();
    const onDismiss = vi.fn();

    render(
      <OfflineAccessNotice
        syncStatus="offline"
        pendingChangesCount={0}
        lastSyncError={null}
        onRetrySync={onRetrySync}
        onDismiss={onDismiss}
        role="staff"
      />
    );

    // Staff available counter features
    expect(screen.getByText("New Order")).toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("Transactions")).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();

    // Staff needs internet: Live Multi-Device Sync
    expect(screen.getByText("Live Multi-Device Sync")).toBeInTheDocument();

    // Admin-only restrictions are hidden from staff
    expect(screen.queryByText("Reports")).not.toBeInTheDocument();
    expect(screen.queryByText("Staff Management")).not.toBeInTheDocument();
    expect(screen.queryByText("Audit Logs")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Import")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();

    // Staff reassurance text
    expect(screen.getByText(/All counter operations are safely cached locally/i)).toBeInTheDocument();
  });
});

describe("Tier 2: Enhanced Action Toasts (showAppErrorToast)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers toast with humanized title, explanation, and action button on retryable error", () => {
    const onRetry = vi.fn();
    const error = new Error("Failed to fetch");

    const parsed = showAppErrorToast(error, {
      onRetry,
    });

    expect(parsed.category).toBe("offline_network");
    expect(parsed.title).toBe("Offline — Saved to Device");
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("No internet connection detected"),
        variant: "destructive",
        action: expect.anything(),
      })
    );
  });

  it("supports custom action callbacks and labels", () => {
    const onAction = vi.fn();
    const error = { message: "session expired", code: 401 };

    const parsed = showAppErrorToast(error, {
      actionLabel: "Sign In Again",
      onAction,
    });

    expect(parsed.category).toBe("session_expired");
    expect(parsed.title).toBe("Session Expired");
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("secure session has timed out"),
        variant: "destructive",
        action: expect.anything(),
      })
    );
  });
});

describe("Tier 3: TopNav Connection & Diagnostics Dialog", () => {
  it("opens ConnectionDiagnosticsDialog when clicking the TopNav status pill", async () => {
    const onRetrySync = vi.fn();

    render(
      <TopNav
        activePage="dashboard"
        onNavigate={vi.fn()}
        onSignOut={vi.fn()}
        adminProfile={{
          id: "u-1",
          name: "Admin User",
          username: "admin",
          email: "admin@test.com",
          role: "admin",
        }}
        syncStatus="error"
        pendingChangesCount={3}
        lastSyncError="503 Service Unavailable"
        onRetrySync={onRetrySync}
        onMenuToggle={vi.fn()}
      />
    );

    // Desktop status pill is a button with role and specific desktop aria-label
    const statusPill = screen.getByRole("button", { name: /Network status: error\. Click to open diagnostics\./i });
    expect(statusPill).toBeInTheDocument();
    fireEvent.click(statusPill);

    // Dialog opens with title and connection details
    expect(await screen.findByText(/Connection & Diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText(/Sync Queue Status/i)).toBeInTheDocument();
    expect(screen.getByText(/3 pending/i)).toBeInTheDocument();

    // Click Retry Sync Now inside modal
    const retryBtn = screen.getByRole("button", { name: /Retry Sync Now/i });
    fireEvent.click(retryBtn);
    expect(onRetrySync).toHaveBeenCalledTimes(1);
  });
});

describe("Tier 4: Inline Form & Modal Alerts", () => {
  it("displays inline error alert inside TransactionEditModal when update fails", async () => {
    const mockTx: Transaction = {
      id: "tx-test-1",
      ticketId: "TKT-0100",
      customerName: "Test Customer",
      phone: "09123456789",
      washType: "Regular",
      weight: 5,
      fee: 200,
      status: "Received",
      paymentStatus: "paid",
      arrivalDateTime: "2026-09-20 10:00",
      dropOffDate: "2026-09-20",
      addOns: [],
    };

    const failingSave = vi.fn().mockRejectedValue(new Error("Record modified by another user"));

    render(
      <TransactionEditModal
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTx}
        onSave={failingSave}
      />
    );

    // Add instructions to trigger hasChanges
    const textarea = screen.getByPlaceholderText(/Add special wash instructions/i);
    fireEvent.change(textarea, { target: { value: "Extra soft" } });

    // Save
    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    // Error alert is displayed inside the modal
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(/Update Conflict Resolved/i)).toBeInTheDocument();
  });
});
