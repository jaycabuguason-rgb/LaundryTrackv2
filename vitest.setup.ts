import "@testing-library/jest-dom/vitest";
import { vi, beforeAll, afterAll } from "vitest";

// Mock next-themes to avoid context issues in unit tests
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock server-only for tests importing server files
vi.mock("server-only", () => ({}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock @supabase/ssr browser client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  channel: vi.fn(() => {
    const ch: Record<string, any> = {
      on: vi.fn(() => ch),
      subscribe: vi.fn(() => ch),
      track: vi.fn().mockResolvedValue("ok"),
      untrack: vi.fn().mockResolvedValue("ok"),
      presenceState: vi.fn().mockReturnValue({}),
    };
    return ch;
  }),
  getChannels: vi.fn(() => []),
  removeChannel: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: vi.fn(() => mockSupabaseClient),
}));

// Suppress console.error for expected error boundaries in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("not wrapped in act") || msg.includes("Warning:")) return;
    originalError.call(console, ...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
