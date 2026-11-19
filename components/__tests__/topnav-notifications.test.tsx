import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import TopNav from "@/components/topnav";
import type { Notification } from "@/lib/data";

const mockNotifications: Notification[] = [
  {
    id: "n-1",
    type: "ready",
    ticketId: "TKT-0001",
    customerName: "Maria Santos",
    time: "10 min ago",
    createdAt: "2026-06-04T08:00:00",
  },
  {
    id: "n-2",
    type: "unclaimed",
    ticketId: "TKT-0002",
    customerName: "Ramon Torres",
    time: "2 days ago",
    createdAt: "2026-06-02T10:00:00",
  },
];

describe("TopNav Notifications Component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders notifications bell button and displays unread count", () => {
    render(
      <TopNav
        activePage="dashboard"
        onNavigate={() => {}}
        onSignOut={() => {}}
        adminProfile={{
          id: "u-1",
          name: "Admin User",
          username: "admin",
          email: "admin@test.com",
          role: "admin",
        }}
        notifications={mockNotifications}
        onMenuToggle={() => {}}
      />
    );

    const bellBtn = screen.getByRole("button", { name: "Notifications" });
    expect(bellBtn).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("subtracts read notifications from localStorage unread badge count", () => {
    localStorage.setItem("laundrytrack-read-notifications", JSON.stringify(["n-1"]));

    render(
      <TopNav
        activePage="dashboard"
        onNavigate={() => {}}
        onSignOut={() => {}}
        adminProfile={{
          id: "u-1",
          name: "Admin User",
          username: "admin",
          email: "admin@test.com",
          role: "admin",
        }}
        notifications={mockNotifications}
        onMenuToggle={() => {}}
      />
    );

    // Only 1 unread left
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("hides unread count badge when all notifications are marked as read in localStorage", () => {
    localStorage.setItem("laundrytrack-read-notifications", JSON.stringify(["n-1", "n-2"]));

    render(
      <TopNav
        activePage="dashboard"
        onNavigate={() => {}}
        onSignOut={() => {}}
        adminProfile={{
          id: "u-1",
          name: "Admin User",
          username: "admin",
          email: "admin@test.com",
          role: "admin",
        }}
        notifications={mockNotifications}
        onMenuToggle={() => {}}
      />
    );

    expect(screen.queryByText("2")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});
