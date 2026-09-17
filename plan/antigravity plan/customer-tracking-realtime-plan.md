# Customer Tracking Page Realtime Plan (Zero Reload)

## Goal
Enable real-time updates on the public tracking page (`/track/[token]`) so customers see status transitions (e.g. `Received` -> `Washing` -> `Ready`) within seconds or sub-second latency **without requiring any browser reload, page refresh, or full server re-render**.

---

## Architectural Strategy: Zero-Reload Hybrid Realtime

### 1. The Core Principle: Client React State Driven
Currently, `app/track/[token]/page.tsx` is a Next.js Server Component that renders static HTML, and `components/tracker-live-refresh.tsx` calls `router.refresh()` every 20 seconds.
Calling `router.refresh()` forces a full App Router Server Component execution.

**New Architecture**:
- Extract the dynamic tracking section into an interactive Client Component: `CustomerTrackingLiveView` (or enhanced `components/customer-tracking-view.tsx`).
- Initialize local React state with server-provided initial data:
  ```tsx
  const [status, setStatus] = useState(initialRecord.status);
  const [eta, setEta] = useState(initialRecord.eta);
  ```
- All status-dependent UI elements (Status Badge, Celebration Banner, Status Stepper, Live Status Indicator, and Pickup QR Code) render directly from this local React state.
- When an update event occurs, calling `setStatus(newStatus)` transitions the UI smoothly in-place in React with **zero page reload, zero white flash, and zero scroll jump**.

---

### 2. Dual-Engine Update Mechanism

#### Engine A: Supabase Realtime (Instant / Sub-second)
- The client component acquires the Supabase client via `getSupabaseBrowserClient()`.
- Subscribes to Postgres CDC changes on the `transactions` table filtered by `ticket_id=eq.${record.ticketId}`:
  ```ts
  const channel = supabase
    .channel(`public:tracking:${record.ticketId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "transactions",
        filter: `ticket_id=eq.${record.ticketId}`,
      },
      (payload) => {
        if (payload.new?.status && payload.new.status !== status) {
          setStatus(payload.new.status);
          if (payload.new.eta) setEta(payload.new.eta);
        }
      }
    )
    .subscribe();
  ```
- As soon as staff changes the status on the counter dashboard, the customer's phone updates in < 500ms.

#### Engine B: Resilient Lightweight JSON Fallback (5–8s Polling)
- What if the customer is on an unstable mobile network, behind a restrictive firewall, or Supabase WebSocket drops?
- A lightweight API endpoint `GET /api/track/[token]` returns `{ status, eta, updatedAt }` (~200 bytes JSON).
- The client checks this JSON every 5–8 seconds:
  - If status has NOT changed: does nothing (0 re-renders, negligible network payload).
  - If status changed: calls `setStatus(data.status)` smoothly.
- **Page Visibility Aware**: If customer switches apps or locks phone (`document.visibilityState === 'hidden'`), the fallback timer sleeps. Upon returning, it runs one check immediately.
- **Terminal Status Shutdown**: Once status is `Claimed` or `Voided`, both the WebSocket channel and the fallback interval teardown completely.

---

### 3. Database RLS Migration
- In Supabase, anonymous users (`anon` role) need SELECT access to `transactions` for Postgres CDC to deliver events to unauthenticated clients.
- Create `scripts/005_anon_tracking_realtime.sql`:
  ```sql
  drop policy if exists "transactions_anon_read_tracking" on public.transactions;
  create policy "transactions_anon_read_tracking"
    on public.transactions
    for select
    to anon
    using (public_tracking_token is not null);
  ```

---

## File Changes

1. **[NEW] `app/api/track/[token]/route.ts`**:
   - Lightweight public endpoint returning status and ETA for public tracking token.
2. **[NEW] `components/customer-tracking-view.tsx`**:
   - Interactive client component managing live status state, Stepper, Status Badge, Celebration Banner, Pickup QR section, and dual-engine listener.
3. **[MODIFY] `app/track/[token]/page.tsx`**:
   - Render `CustomerTrackingView` passing `initialRecord={record}` and `token={token}`.
4. **[NEW] `scripts/005_anon_tracking_realtime.sql`**:
   - RLS policy allowing anon read on tracking token for Realtime publication.
5. **[NEW] `components/__tests__/customer-tracking-view.test.tsx`**:
   - Unit tests for zero-reload updates, realtime events, fallback polling, and cleanup on terminal status.

---

## Verification Plan
1. **Automated Tests**:
   - Run Vitest tests for `CustomerTrackingView` and API route.
2. **Manual Simulation**:
   - Open public tracking page in browser.
   - Update transaction status via API / staff interface.
   - Verify tracking page steppers, badges, and QR code update in real-time without reloading the page.

