import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AuditLogsPage from "@/components/pages/audit-logs";
import type { AuditLogEntry } from "@/lib/audit-log-contracts";
import type { UserProfile } from "@/lib/auth";

const mockAuditLogs: AuditLogEntry[] = [
  {
    id: "AL-101",
    timestamp: "2026-04-15T14:32:00",
    staffName: "Maria Santos",
    staffRole: "Staff",
    action: "transaction_created",
    summary: "Created transaction TKT-0012",
    details: "Customer: Jose Reyes | Service: Full Wash | Fee: PHP 250",
    ticketId: "TKT-0012",
    ipAddress: "192.168.1.10",
  },
  {
    id: "AL-102",
    timestamp: "2026-04-15T13:45:00",
    staffName: "Juan dela Cruz",
    staffRole: "Staff",
    action: "transaction_voided",
    summary: "Voided ticket TKT-0008",
    details: "Void reason: Customer cancelled order",
    ticketId: "TKT-0008",
    ipAddress: "192.168.1.11",
  },
  {
    id: "AL-103",
    timestamp: "2026-04-15T12:10:00",
    staffName: "Admin User",
    staffRole: "Admin",
    action: "settings_changed",
    summary: "Updated pricing settings",
    details: "Changed full wash rate from PHP 220 to PHP 250",
    ipAddress: "192.168.1.1",
  },
];

const mockRefresh = vi.fn();

vi.mock("@/hooks/use-audit-logs", () => ({
  useAuditLogs: () => ({
    auditLogs: mockAuditLogs,
    loading: false,
    error: null,
    refresh: mockRefresh,
    usingSupabase: true,
  }),
}));

vi.mock("boneyard-js/react", () => ({
  Skeleton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/pages/staff-management", () => ({
  default: () => <div data-testid="mock-staff-management-page">Staff Management Page</div>,
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

describe("AuditLogsPage Mobile View", () => {
  const mockProfile: UserProfile = {
    id: "admin-1",
    email: "admin@laundrytrack.test",
    name: "Jay Admin",
    username: "jayadmin",
    role: "admin",
    avatar: "/avatars/admin.png",
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mobile header, live admin badge, and metrics carousel", () => {
    render(<AuditLogsPage initialTab="audit" currentProfile={mockProfile} />);

    // Header title & subtitle
    expect(screen.getAllByText("Staff & Audit Logs").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Team management and system activity").length
    ).toBeGreaterThanOrEqual(1);

    // Live admin badge
    expect(screen.getByText("Jay Admin")).toBeInTheDocument();
    expect(screen.getAllByText(/admin/i).length).toBeGreaterThanOrEqual(1);

    // Metrics Carousel values
    expect(screen.getAllByText("Total Entries").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Warning Events").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("System Actions").length).toBeGreaterThanOrEqual(1);

    // Check count values (3 total entries, 1 warning event: transaction_voided, 1 system action: settings_changed)
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2);
  });

  it("renders mobile segmented tabs and allows navigating to staff management", () => {
    render(<AuditLogsPage initialTab="audit" currentProfile={mockProfile} />);

    const staffTabButtons = screen.getAllByRole("button", { name: /staff management/i });
    expect(staffTabButtons.length).toBeGreaterThanOrEqual(1);

    // Click mobile Staff Management button
    fireEvent.click(staffTabButtons[0]);

    // Should switch to staff management view
    expect(screen.getByTestId("mock-staff-management-page")).toBeInTheDocument();
  });

  it("renders mobile audit cards and expands/collapses detailed metadata", () => {
    render(<AuditLogsPage initialTab="audit" currentProfile={mockProfile} />);

    // Mobile card and desktop table both render summaries
    expect(screen.getAllByText("Created transaction TKT-0012").length).toBe(2);
    expect(screen.getAllByText("Voided ticket TKT-0008").length).toBe(2);
    expect(screen.getAllByText("Updated pricing settings").length).toBe(2);

    // Ticket badges on mobile cards
    expect(screen.getByText("#TKT-0012")).toBeInTheDocument();
    expect(screen.getByText("#TKT-0008")).toBeInTheDocument();

    // Expanded details initially hidden
    expect(screen.queryByText(/Full Details:/i)).not.toBeInTheDocument();

    // Find the mobile card button for AL-101 and click to expand
    const cardButton = screen.getByRole("button", {
      name: /Toggle details for log AL-101/i,
    });
    fireEvent.click(cardButton);

    // Expanded details section now visible
    expect(screen.getByText(/Full Details:/i)).toBeInTheDocument();
    expect(screen.getByText("AL-101")).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(cardButton);
    expect(screen.queryByText(/Full Details:/i)).not.toBeInTheDocument();
  });

  it("filters feed by search query and allows clearing search", () => {
    render(<AuditLogsPage initialTab="audit" currentProfile={mockProfile} />);

    const searchInputs = screen.getAllByLabelText(/search audit logs/i);
    const mobileSearchInput = searchInputs[0];

    // Search for "TKT-0008"
    fireEvent.change(mobileSearchInput, { target: { value: "TKT-0008" } });

    expect(screen.getAllByText("Voided ticket TKT-0008").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Created transaction TKT-0012")).not.toBeInTheDocument();

    // Search with non-matching query
    fireEvent.change(mobileSearchInput, { target: { value: "nonexistent-query-xyz" } });
    expect(screen.getByText("No audit logs found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters or search terms")).toBeInTheDocument();
  });

  it("renders end of feed synchronization notice when items are present", () => {
    render(<AuditLogsPage initialTab="audit" currentProfile={mockProfile} />);

    expect(screen.getByText(/Feed synchronized • 3 events loaded/i)).toBeInTheDocument();
  });
});
