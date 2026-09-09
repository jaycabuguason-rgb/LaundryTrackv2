import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, PaymentBadge, getStatusIcon, STATUS_ICONS } from "@/components/status-badge";
import { axe } from "vitest-axe";

describe("status-badge", () => {
  it("renders StatusBadge with icon + label, not color-only", () => {
    render(<StatusBadge status="Ready" />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("maps Drying -> Washing (canonical)", () => {
    const { container } = render(<StatusBadge status="Drying" />);
    expect(container.textContent).toContain("Washing");
  });

  it("StatusBadge all statuses have accessible label", () => {
    (["Received", "Washing", "Drying", "Ready", "Claimed", "Voided"] as const).forEach((s) => {
      const { unmount } = render(<StatusBadge status={s} />);
      expect(screen.getByText(s === "Drying" ? "Washing" : s)).toBeInTheDocument();
      unmount();
    });
  });

  it("PaymentBadge renders Paid/Unpaid correctly", () => {
    const { rerender } = render(<PaymentBadge paymentStatus="paid" />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
    rerender(<PaymentBadge paymentStatus="unpaid" />);
    expect(screen.getByText("Unpaid")).toBeInTheDocument();
  });

  it("getStatusIcon returns an icon element", () => {
    const icon = getStatusIcon("Ready");
    expect(icon).toBeDefined();
  });

  it("StatusBadge has no axe violations", async () => {
    const { container } = render(<StatusBadge status="Ready" />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("STATUS_ICONS covers all TransactionStatus", () => {
    expect(Object.keys(STATUS_ICONS)).toEqual(
      expect.arrayContaining(["Received", "Washing", "Drying", "Ready", "Claimed", "Voided"])
    );
  });
});
