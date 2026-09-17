# Realtime Status and Report Sync Plan

## Decision

Implement direct transaction reconciliation from Supabase Realtime events, while retaining optimistic status changes and safe recovery refreshes. This avoids page reloads and makes reports update from the same transaction state as the rest of the application.

Do not change `hooks/usePeakHours.ts`. The active Reports page derives all of its metrics from its `transactions` prop and does not use that hook.

## Goals

- A Processing-stage change is visible immediately in the initiating browser.
- A status change made from another tab or staff device appears without manual reload.
- Report totals, status counts, charts, and transaction lists all use the same current transaction data.
- Offline and failed requests remain recoverable without losing the existing optimistic UI behavior.
- Rapid repeated status actions cannot create conflicting requests for one ticket.

## Scope

The Processing workflow covered here is **Received -> Washing (including Drying) -> Ready**. `Claimed` is handled through Claim Verification/Transactions and is not a Processing-stage transition. `Voided` is likewise outside the normal Processing flow.

### Files to modify

- `hooks/use-transactions.ts`
- `components/pages/processing.tsx`
- Transaction-hook tests, plus new focused tests if coverage is missing.

### Files intentionally out of scope

- `hooks/usePeakHours.ts` — currently unused by `components/pages/reports.tsx`.
- `components/pages/reports.tsx` — it already recalculates from the shared `transactions` prop.
- Customer tracker polling — assess separately after internal staff/report synchronization is verified.

## Design

```text
Staff changes a status
  -> Hook applies optimistic local transaction update immediately
  -> Processing page shows a subtle per-ticket saving state
  -> PATCH persists the authoritative transaction on the server
  -> Supabase broadcasts INSERT, UPDATE, or DELETE to open clients
  -> Every client patches the corresponding transaction and local cache
  -> Reports re-render from the same transaction list

Fallbacks
  -> Initial application load fetches authoritative transactions
  -> Browser reconnect or focus triggers a background refresh
  -> Unmappable Realtime payload triggers one background refresh
```

## Implementation Tasks

## Required Implementation Order

Implement in this order. Each step reduces risk for the next one.

1. **Fix the stale-refresh overwrite race first.** Add a pending-mutation record per ticket in `use-transactions.ts`. While a PATCH is outstanding, a list refresh or Realtime event must not replace that ticket with an older server version. Add the deterministic regression test: optimistic `Received` -> delayed stale refresh containing `Washing` -> successful PATCH returning `Received`; the ticket must never return to `Washing`.
2. **Verify the live Supabase prerequisite.** Confirm the deployed `public.transactions` table is published to Realtime and that two authenticated staff sessions can subscribe. If this is not working, code changes cannot deliver cross-device updates.
3. **Complete direct Realtime reconciliation in `use-transactions.ts`.** This is the shared data foundation for Processing, Dashboard, and Reports. Include cache persistence and the malformed-event refresh fallback.
4. **Write and run the transaction-hook tests.** Cover INSERT, UPDATE, DELETE, malformed payloads, cache persistence, and the stale-refresh race before modifying the Processing UI.
5. **Test two-browser synchronization manually.** Confirm a status change in one session changes the other session's transaction list and report metrics without a reload.
6. **Refine Processing optimistic feedback.** Keep the per-ticket mutation guard; replace only the disruptive spinner/disabled presentation with a subtle pending state after the shared synchronization behavior is proven.
7. **Add recovery behavior.** Add debounced focus/visibility refresh if needed, then test offline queue recovery and reconnect synchronization.
8. **Run the full regression suite and acceptance checks.** Run `pnpm test`, then complete the manual checks below.

Do not start with UI changes or per-second polling. Those can mask a broken Realtime configuration and do not make reports reliably correct.

### 1. Add a shared client-side Realtime-row mapper

In `hooks/use-transactions.ts`, introduce a small mapper for a Supabase `transactions` row to the existing `Transaction` shape.

It must map snake_case fields such as `ticket_id`, `customer_name`, `arrival_time`, `weight_kg`, and `payment_status`; preserve optional fields including `eta`, `void_reason`, `public_tracking_token`, `updated_at`, and `claimed_at`; and normalize values consistently with the API's returned transaction shape.

Keep this mapper local to the hook unless another active client consumer actually needs it. Do not extract or reuse the mapper in `usePeakHours.ts`.

### 1a. Prevent an in-flight mutation from being overwritten

This is the first implementation change because it fixes the observed visual jump:

```text
optimistic update: Washing -> Received
stale full-list refresh: Washing       <- must be ignored for this ticket
PATCH response: Received               <- authoritative update; clear pending state
```

Track a unique mutation version or timestamp for each ticket when `updateTransaction()` begins. While that ticket is pending:

- A `refresh()` result must merge into current state and retain the pending local version of that ticket.
- A Realtime event must not overwrite it unless it is known to be the corresponding/newer server version.
- On PATCH success, replace the optimistic version with the API response and clear the pending marker.
- On PATCH failure, roll back only that mutation's version and clear the marker.

Do not resolve this with frequent polling or a page reload; both make the race more likely and make the interface feel worse.

### 2. Reconcile Realtime events directly

Replace the current Realtime callback that always calls `refresh()` with direct state/cache updates through the existing `updateTransactions()` helper:

- `INSERT`: map `payload.new`; prepend it unless the ticket already exists, in which case replace the existing transaction.
- `UPDATE`: map `payload.new`; replace by stable `id` first, falling back to `ticketId`; if absent, append it.
- `DELETE`: remove by `payload.old.id`. Enable `REPLICA IDENTITY FULL` only if the deployed database does not provide the primary key in delete payloads.

`updateTransactions()` already writes the resulting list to the offline cache. Preserve that behavior so a restart does not show stale cached data.

If a payload is malformed or cannot be mapped, call the existing background `refresh()` once rather than corrupting local state. Avoid setting a blocking loading state for normal Realtime events.

### 3. Retain safe optimistic mutations

Keep the immediate optimistic update and rollback behavior in `updateTransaction()`.

Add per-ticket in-flight tracking in the transaction hook, or retain the existing `updatingTicket` behavior in Processing, so a ticket cannot receive a second status request until its prior request resolves. The UI must remain responsive: the card can move immediately, while its status action is temporarily disabled or labelled “Saving…”.

Do not change status actions to unrestricted fire-and-forget requests. Concurrent requests for one ticket can reach the server out of order and make the final status incorrect.

On a successful mutation, replace the optimistic record with the API response. On failure, roll back only if the optimistic version is still current; then show an error toast.

### 4. Make Processing feel immediate without sacrificing ordering

In `components/pages/processing.tsx`:

- Keep the current per-ticket protection against duplicate clicks.
- Ensure the optimistic update happens before any server wait (the hook already provides this).
- Replace the visually heavy blocking treatment with a compact “Saving…” or pending indicator, if needed.
- Keep success/error messages accurate: status movement can be acknowledged immediately, but loyalty/reward messages must wait for the server response.
- Keep the existing confirmation dialog behavior for actions that are outside the normal Processing flow; do not add `Claimed` as a Processing-stage action.
- Keep bulk update behavior separate; concurrent updates are acceptable across different tickets, but each ticket must have only one active mutation.

### 5. Recovery refreshes

- Keep the initial `refresh()`.
- Keep the existing online/reconnect refresh and offline queue processing.
- Add a debounced refresh when the document becomes visible or the window regains focus, if this is not already handled elsewhere.
- Never poll staff reports every second. Realtime is primary; a low-frequency fallback of 15–30 seconds is optional only if live Realtime reliability proves inadequate.

### 6. Verify live Supabase prerequisites

Before declaring the feature complete, confirm in the deployed project:

- `public.transactions` is part of the `supabase_realtime` publication.
- Authenticated staff satisfy the table's Realtime/RLS access requirements.
- Realtime channel subscription reaches `SUBSCRIBED`.
- A change in one authenticated browser session emits an event in another session.

The repository's `supabase/SETUP_SUPABASE.sql` contains publication setup, but it must have been executed against the actual deployed database.

## Tests

Add or update tests to cover:

1. Realtime INSERT adds a transaction and persists the updated cache.
2. Realtime UPDATE changes one transaction without replacing unrelated ones.
3. Realtime DELETE removes the correct transaction.
4. Invalid Realtime input triggers a safe refresh instead of modifying state.
5. Optimistic status change is visible before the PATCH resolves.
6. Failed PATCH rolls the status back and reports an error.
7. A second status click on the same ticket is prevented while its first mutation is pending.
8. Reports receive the changed `transactions` prop and update their counts and derived metrics.

Run `pnpm test` after implementation.

## Manual Acceptance Check

1. Sign into two browser sessions as staff.
2. In session A, move a Processing ticket from Washing to Ready.
3. Confirm it moves immediately in session A, without a full-page reload.
4. Confirm session B reflects the change within about a second.
5. Open Reports in session B and confirm the Ready/Processing counts and related views change automatically.
6. Create and void orders in session A; confirm session B reconciles insert, update, and delete-like effects correctly.
7. Simulate a failed request and confirm the initiating session rolls back safely.
8. Disconnect and reconnect; confirm the queued changes synchronize and an authoritative refresh occurs.

## Completion Criteria

- No manual page reload is needed for normal staff status or transaction changes.
- Reports and operational pages show the same transaction state.
- No full HTTP transaction-list fetch occurs for every valid Realtime event.
- The app remains correct when Realtime disconnects, an API mutation fails, or a user double-clicks a status action.
