import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleBadge, ShiftStatusBadge } from "@/components/pages/staff-management";
import { useStaffPresence } from "@/hooks/use-staff-presence";

describe("Staff Management - Unified Role and Real-Time Shift Status", () => {
  describe("RoleBadge", () => {
    it("renders Admin badge for Admin role", () => {
      render(<RoleBadge role="Admin" />);
      expect(screen.getByText("Admin")).toBeInTheDocument();
    });

    it("renders Staff badge for Staff role", () => {
      render(<RoleBadge role="Staff" />);
      expect(screen.getByText("Staff")).toBeInTheDocument();
    });

    it("unifies Cashier role into Staff badge", () => {
      render(<RoleBadge role="Cashier" />);
      expect(screen.getByText("Staff")).toBeInTheDocument();
    });

    it("unifies lowercase cashier into Staff badge", () => {
      render(<RoleBadge role="cashier" />);
      expect(screen.getByText("Staff")).toBeInTheDocument();
    });
  });

  describe("ShiftStatusBadge", () => {
    it("renders On Shift badge for active on-shift status", () => {
      render(<ShiftStatusBadge status="On Shift" />);
      expect(screen.getByText("On Shift")).toBeInTheDocument();
    });

    it("renders Off Duty badge for off-duty status", () => {
      render(<ShiftStatusBadge status="Off Duty" />);
      expect(screen.getByText("Off Duty")).toBeInTheDocument();
    });

    it("defaults to Off Duty for undefined status", () => {
      render(<ShiftStatusBadge />);
      expect(screen.getByText("Off Duty")).toBeInTheDocument();
    });
  });

  describe("useStaffPresence", () => {
    function PresenceProbe({ currentProfile, targetStaff }: { currentProfile: any; targetStaff: any }) {
      const { isStaffOnline } = useStaffPresence(currentProfile);
      const online = isStaffOnline(targetStaff);
      return <div data-testid="status">{online ? "ONLINE" : "OFFLINE"}</div>;
    }

    it("recognizes currentProfile as online immediately", () => {
      const profile = {
        id: "user-123",
        name: "Maria Santos",
        username: "maria",
        email: "maria@example.com",
        phone: "09123456789",
        role: "staff" as const,
      };
      render(<PresenceProbe currentProfile={profile} targetStaff={{ id: "user-123", isActive: true }} />);
      expect(screen.getByTestId("status")).toHaveTextContent("ONLINE");
    });

    it("returns false for offline staff", () => {
      const profile = {
        id: "user-123",
        name: "Maria Santos",
        username: "maria",
        email: "maria@example.com",
        phone: "09123456789",
        role: "staff" as const,
      };
      render(<PresenceProbe currentProfile={profile} targetStaff={{ id: "other-user", isActive: true }} />);
      expect(screen.getByTestId("status")).toHaveTextContent("OFFLINE");
    });

    it("returns false when staff isActive is false even if online", () => {
      const profile = {
        id: "user-123",
        name: "Maria Santos",
        username: "maria",
        email: "maria@example.com",
        phone: "09123456789",
        role: "staff" as const,
      };
      render(<PresenceProbe currentProfile={profile} targetStaff={{ id: "user-123", isActive: false }} />);
      expect(screen.getByTestId("status")).toHaveTextContent("OFFLINE");
    });
  });
});
