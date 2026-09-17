# Real-Time Data Sync — Live Updates Without Page Reload

This plan covers the second issue you described: **new data not appearing immediately in reports and across the app** without refreshing the page.

> [!NOTE]
> This plan is fully compatible with the **Optimistic UI plan**. They fix two different things:
> - **Optimistic UI plan** → fixes the *feel* of clicking a button (instant feedback)
> - **This plan** → fixes the *data staying fresh* on its own, even when someone else makes a change from another device or tab

---

## What's Happening Today

### Problem 1 — Realtime triggers a full HTTP re-fetch (slow)

In [`use-transactions.ts`](file:///e:/sample%20project/LaundryTrackv2-pr-11/hooks/use-transactions.ts) (lines 278–291), there's already a Supabase Realtime subscription that fires on **any** DB change:

```ts
supabase.channel("laundrytrack-transactions")
  .on("postgres_changes", { event: "*", table: "transactions" }, () => {
    void refreshRef.current?.();   // ← calls refresh() every time
  })
```

**The problem:** `refresh()` does a **full HTTP round-trip** to `/api/transactions` every time (lines 127–164). That means:
- It sets `loading: true` (may flash a spinner in some pages)
- It waits for the network (adds latency)
- It replaces the entire transaction list

Supabase Realtime actually delivers the **changed row directly in the event payload** (`payload.new`). We can use that to update state instantly — no HTTP call needed.

---

### Problem 2 — Peak Hours chart only reacts to new orders, not status changes

In [`usePeakHours.ts`](file:///e:/sample%20project/LaundryTrackv2-pr-11/hooks/usePeakHours.ts) (lines 126–142), the Realtime subscription only listens for `INSERT`:

```ts
.on("postgres_changes", { event: "INSERT", ... }, () => fetchData())
```

So if someone **updates a status** (e.g. `Washing → Ready`) or **voids** a transaction, the Reports chart never updates. It only refreshes when a brand new order is placed.

---

## Proposed Changes

### Fix 1 — Smart Realtime listener in the transactions hook

#### [MODIFY] [use-transactions.ts](file:///e:/sample%20project/LaundryTrackv2-pr-11/hooks/use-transactions.ts)

Split the single `event: "*"` listener into three specific listeners — `INSERT`, `UPDATE`, and `DELETE` — and handle each with a direct state update instead of a full re-fetch:

| Event | What happens | Action |
|---|---|---|
| `INSERT` | A new order was placed (from another device/tab) | Prepend `payload.new` to the list directly |
| `UPDATE` | A status was changed (from another device/tab) | Replace that row in the list directly |
| `DELETE` | A transaction was deleted | Remove that row from the list directly |

The `refresh()` (full HTTP fetch) is still kept as a **fallback** — it runs once on page load and when coming back online. But it no longer runs on every Realtime event.

> [!IMPORTANT]
> The Supabase Realtime payload uses **snake_case** column names (e.g. `customer_name`, `ticket_id`). We need a small `mapRow()` helper to convert it to the app's camelCase `Transaction` shape. This helper already partially exists in `usePeakHours.ts` (lines 89–104) — we'll extract and reuse it.

---

### Fix 2 — Reports chart reacts to all changes

#### [MODIFY] [usePeakHours.ts](file:///e:/sample%20project/LaundryTrackv2-pr-11/hooks/usePeakHours.ts)

Change the Realtime event filter from `INSERT` only → `"*"` (all events):

```ts
// Before
{ event: "INSERT", ... }

// After
{ event: "*", ... }
```

This means the peak hours chart in Reports will now update whenever:
- A new order arrives ✅ (already working)
- A status is changed → affects the "today's activity" calculation ✅ (new)
- A transaction is voided → should be excluded from the chart ✅ (new)

---

## How They Work Together

```
Another device changes a status
  ↓
Supabase Realtime fires (WebSocket — near instant, ~50–150ms)
  ↓
use-transactions: applies payload.new directly to state (no HTTP)
  ↓
All pages (Processing, Reports, Dashboard) re-render with new data
  ↓
usePeakHours: Realtime also fires → chart recalculates instantly
```

Compare to today:
```
Another device changes a status
  ↓
Supabase Realtime fires
  ↓
refresh() → full HTTP fetch → waits 300–1500ms
  ↓
Pages re-render (with brief loading state)
  ↓
Peak hours chart: does NOT update on status change
```

---

## Verification Plan

### Automated Tests
- Run `pnpm test` — no logic changes in the hook's public API, so existing tests should pass

### Manual Verification
1. Open the app in **two browser tabs** (both logged in)
2. In Tab 1, go to Processing → click "Mark Ready" on a ticket
3. In Tab 2, also on Processing → the card should move to Ready **automatically, within a second, with no page refresh**
4. In Tab 2, go to Reports → the chart data should update within a second
5. Test: void a transaction in Tab 1 → Reports chart in Tab 2 should exclude it automatically
6. Test: place a new order in Tab 1 → appears in Tab 2's transaction list automatically

---

## Summary of Files Changed

| File | What changes |
|---|---|
| [`use-transactions.ts`](file:///e:/sample%20project/LaundryTrackv2-pr-11/hooks/use-transactions.ts) | Replace single `refresh()` Realtime callback → direct state patch per event type + extract `mapRow()` helper |
| [`usePeakHours.ts`](file:///e:/sample%20project/LaundryTrackv2-pr-11/hooks/usePeakHours.ts) | Change `event: "INSERT"` → `event: "*"` so chart reacts to updates and deletes too |
