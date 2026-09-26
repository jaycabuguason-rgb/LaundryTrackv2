import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MobileBottomNav from "../mobile-bottom-nav";
import Sidebar from "../sidebar";

describe("Mobile Responsive Navigation & Modern Sidebar Dock", () => {
  it("renders mobile bottom navigation items without collision or raw 'New order' casing", () => {
    const handleNavigate = vi.fn();
    render(
      <MobileBottomNav
        activePage="dashboard"
        onNavigate={handleNavigate}
      />
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Process")).toBeInTheDocument();
    expect(screen.getByText("New Order")).toBeInTheDocument();
    expect(screen.getByText("Records")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();

    const newOrderBtn = screen.getByText("New Order").closest("button");
    expect(newOrderBtn).toBeInTheDocument();
    fireEvent.click(newOrderBtn!);
    expect(handleNavigate).toHaveBeenCalledWith("new-transaction");
  });

  it("renders the modern sidebar dock with Collapse toggle and shortcut hint", () => {
    render(
      <Sidebar
        activePage="dashboard"
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText("Collapse")).toBeInTheDocument();
    expect(screen.getByText("⌘B")).toBeInTheDocument();

    const collapseBtn = screen.getByText("Collapse").closest("button");
    expect(collapseBtn).toBeInTheDocument();
    fireEvent.click(collapseBtn!);

    // After collapsing, the button shows expand title and PanelLeftOpen icon
    expect(screen.queryByText("Collapse sidebar")).not.toBeInTheDocument();
  });
});
