import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfilePage from "@/components/pages/profile";
import TopNav from "@/components/topnav";
import type { UserProfile } from "@/lib/auth";

vi.mock("@/lib/supabase/browser-session", () => ({
  getBrowserAccessToken: vi.fn().mockResolvedValue("test-token"),
  refreshBrowserSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

// Mock pointer capture methods, PointerEvent, and ResizeObserver for Radix UI in jsdom
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  if (typeof window.PointerEvent === "undefined") {
    // @ts-expect-error polyfill for jsdom
    window.PointerEvent = window.MouseEvent;
  }
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("Profile Picture Viewer", () => {
  const mockProfile: UserProfile = {
    id: "user-123",
    name: "Jane Laundry",
    username: "janelaundry",
    email: "jane@laundrytrack.com",
    role: "admin",
    avatarUrl: "https://example.com/avatar.jpg",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens photo viewer modal when avatar is clicked in ProfilePage", async () => {
    render(<ProfilePage userProfile={mockProfile} />);

    const avatarButton = screen.getByRole("button", { name: /view profile picture/i });
    expect(avatarButton).toBeInTheDocument();

    fireEvent.click(avatarButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      const modalImage = screen.getByRole("img", { name: "Jane Laundry" });
      expect(modalImage).toBeInTheDocument();
      expect(modalImage).toHaveAttribute("src", "https://example.com/avatar.jpg");
    });

    const closeBtns = screen.getAllByRole("button", { name: /close/i });
    fireEvent.click(closeBtns[0]);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("opens photo viewer modal when View Photo action button is clicked in ProfilePage", async () => {
    render(<ProfilePage userProfile={mockProfile} />);

    const viewPhotoBtn = screen.getByRole("button", { name: /view photo/i });
    expect(viewPhotoBtn).toBeInTheDocument();

    fireEvent.click(viewPhotoBtn);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("does not allow viewing photo if user has no avatar", () => {
    const noAvatarProfile: UserProfile = {
      ...mockProfile,
      avatarUrl: undefined,
    };
    render(<ProfilePage userProfile={noAvatarProfile} />);

    // Avatar button should be disabled for viewing photo
    const avatarButton = screen.getByRole("button", { name: /profile initials/i });
    expect(avatarButton).toBeDisabled();
    expect(screen.queryByRole("button", { name: /view photo/i })).not.toBeInTheDocument();
  });

  it("renders profile avatar with image in TopNav", () => {
    render(
      <TopNav
        activePage="dashboard"
        onNavigate={vi.fn()}
        onSignOut={vi.fn()}
        adminProfile={mockProfile}
        onMenuToggle={vi.fn()}
      />
    );

    const avatarImg = screen.getByAltText("Jane Laundry");
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute("src", expect.stringContaining("https://example.com/avatar.jpg"));
  });
});
