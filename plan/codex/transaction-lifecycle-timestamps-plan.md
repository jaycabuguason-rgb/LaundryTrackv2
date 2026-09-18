# Transaction Lifecycle Timestamps Plan

## Objective

Show the date and time an order was **Claimed** or **Voided** directly in the Transactions list/card, without requiring staff to open ticket details.

`transaction-lifecycle-timestamps` is the recommended name because it describes terminal transaction events and leaves room for future milestones, such as Ready or payment timestamps.

## User Experience

In the Claimed and Voided tabs, every visible transaction row must show the terminal event time next to the status badge:

```text
[Claimed]  Claimed Sep 18, 2026 · 2:34 PM
[Voided]   Voided Sep 18, 2026 · 3:08 PM
           Reason: Customer cancelled
```

This must appear in both desktop transaction rows and mobile cards. It is supplemental information: opening **View** continues to show full ticket details.

## Current Data Gap

- The data model already has `claimed_at` / `claimedAt`.
- It does not have a dedicated `voided_at` / `voidedAt` field.
- `updated_at` cannot safely stand in for `voided_at`, because a voided ticket could be edited later and then show the wrong void time.

## Implementation Order

1. **Add durable terminal timestamps to the database.** Create a migration that adds `voided_at timestamptz` to `public.transactions`. Retain the existing `claimed_at` column.
2. **Set timestamps at the transaction boundary.** When status becomes `Claimed`, set `claimed_at` only if it is empty. When status becomes `Voided`, set `voided_at` only if it is empty. Do not overwrite either timestamp on later edits.
3. **Expose both fields end-to-end.** Update the repository select/mapping types, API responses, browser Realtime mapper, mock data, and `Transaction` type with `voidedAt`.
4. **Add inline status-time display.** In `components/pages/transactions.tsx`, render the claimed or voided time beside/below the terminal status badge in desktop rows and mobile cards. Use a consistent locale-aware date/time formatter and a compact, readable label.
5. **Keep the status time accurate under sync.** Optimistic status changes may show `Saving...`; after the server response or Realtime update, replace it with the authoritative terminal timestamp. Never guess a permanent timestamp from the client clock.
6. **Test and verify.** Cover claimed, voided, reload, realtime, and later-edit behavior.

## Display Rules

- **Claimed tab:** show `Claimed <date and time>` from `claimedAt`.
- **Voided tab:** show `Voided <date and time>` from `voidedAt`, followed by the void reason when present.
- **All Transactions tab:** show the timestamp only for records whose current status is Claimed or Voided; do not add visual noise to active orders.
- If an older migrated record does not yet have a terminal timestamp, show a neutral fallback such as `Claimed time unavailable` rather than pretending `updatedAt` is the claim/void time.
- Keep date/time text visible without hover, clicking, or opening the detail modal.

## Database Migration Requirements

- Add `voided_at timestamp with time zone`.
- Backfill only when there is trustworthy historical data. Do not fabricate exact historical void times.
- Ensure the existing transaction update operation returns `claimed_at`, `voided_at`, and `updated_at` after every status change.
- Preserve RLS and the existing Realtime publication configuration for `public.transactions`.

## Tests

1. Claiming a ticket stores a `claimed_at` value and shows it directly in the Claimed list row.
2. Voiding a ticket stores a `voided_at` value and shows it directly in the Voided list row with its reason.
3. A reload retains both timestamps.
4. A second staff session receives and displays the timestamp after a Realtime update.
5. Editing payment, notes, or another allowed field after claim/void does not change the terminal timestamp.
6. Desktop and mobile transaction views show the same terminal date and time.

## Manual Acceptance Check

1. Claim a Ready, paid order through Claim Verification.
2. Open Transactions -> Claimed and confirm the claimed date/time is visible on its row without selecting View.
3. Void another order with a reason.
4. Open Transactions -> Voided and confirm the voided date/time and reason are visible on its row without selecting View.
5. Reload and repeat in a second staff browser session; confirm both values remain identical.
