import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AuditLogsPage from "@/components/pages/audit-logs";
import StaffManagementPage from "@/components/pages/staff-management";
import type { UserProfile } from "@/lib/auth";

vi.mock("@/hooks/use-staff-accounts", () => ({
  useStaffAccounts: () => ({
    staff: [
      {
        id: "staff-1",
        fullName: "Juan Dela Cruz",
        username: "juandc",
        email: "juan@laundrytrack.ph",
        role: "Staff",
        phoneNumber: "09171234567",
        isActive: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createStaff: vi.fn(),
    updateStaff: vi.fn(),
    resetPassword: vi.fn(),
    usingSupabase: true,
  }),
}));

vi.mock("@/hooks/use-staff-presence", () => ({
  useStaffPresence: () => ({
    isStaffOnline: () => true,
    onlineStaffIds: new Set(["staff-1"]),
  }),
}));

vi.mock("@/hooks/use-audit-logs", () => ({
  useAuditLogs: () => ({
    auditLogs: [
      {
        id: "AL-101",
        timestamp: "2026-04-15T14:32:00",
        staffName: "Juan Dela Cruz",
        staffRole: "Staff",
        action: "transaction_created",
        summary: "Created transaction TKT-0012",
        ticketId: "TKT-0012",
      },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
    usingSupabase: true,
  }),
}));

vi.mock("boneyard-js/react", () => ({
  Skeleton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("Staff Management & Audit Logs Tab Switching", () => {
  const mockProfile: UserProfile = {
    id: "admin-1",
    email: "admin@laundrytrack.test",
    name: "Jay Admin",
    username: "jayadmin",
    role: "admin",
    avatar: "/avatars/admin.png",
    isActive: true,
  };

  it("switches seamlessly between Staff Management and Audit Logs without blank screen", () => {
    render(<AuditLogsPage initialTab="staff" currentProfile={mockProfile} />);

    // Initially on Staff Management
    expect(screen.getAllByText("Juan Dela Cruz").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Add Staff")).toBeInTheDocument();

    // Click Audit Logs tab
    const auditTabButtons = screen.getAllByRole("button", { name: /audit logs/i });
    expect(auditTabButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(auditTabButtons[0]);

    // Now on Audit Logs view
    expect(screen.getAllByText("Created transaction TKT-0012").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Add Staff")).not.toBeInTheDocument();

    // Switch back to Staff Management
    const staffTabButtons = screen.getAllByRole("button", { name: /staff management/i });
    expect(staffTabButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(staffTabButtons[0]);

    // Back on Staff Management view
    expect(screen.getAllByText("Juan Dela Cruz").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Add Staff")).toBeInTheDocument();
  });

  it("handles standalone StaffManagementPage switching safely without crashing", () => {
    const onTabChange = vi.fn();
    render(<StaffManagementPage initialTab="staff" onTabChange={onTabChange} currentProfile={mockProfile} />);

    expect(screen.getAllByText("Juan Dela Cruz").length).toBeGreaterThanOrEqual(1);

    const auditButtons = screen.getAllByRole("button", { name: /audit logs/i });
    fireEvent.click(auditButtons[0]);

    expect(onTabChange).toHaveBeenCalledWith("audit");
  });
});
