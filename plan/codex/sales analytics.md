# Sales Analytics: Payment-Recognized Revenue Plan

## Objective

Make **Sales Analytics** represent money actually collected, rather than the
value of all orders created in the selected drop-off period. A sale is
recognized when an order changes from `unpaid` to `paid`; claiming an order is
a separate fulfilment event that may happen at the same time.

## Business Rules

| Event or state | Revenue treatment | Operational treatment |
| --- | --- | --- |
| Order created, unpaid | Not sales revenue; included in outstanding balance | Received / in progress |
| Payment confirmed | Count the fee once, on the payment date | Paid |
| Order claimed | Does not add revenue again | Fulfilled / released |
| Paid order claimed later | Remains revenue on its original payment date | Claimed |
| Voided order | Never counted as revenue | Voided |
| Legacy paid order without a payment time | Preserve its paid status but list it as an attribution exception until backfilled | Do not silently assign a false payment date |

The system must reject a transition to `Claimed` unless the resulting payment
status is `paid`. This rule belongs on the server, not only in the claim UI.

## Data Model

1. Add `paid_at timestamptz null` to `public.transactions` in a new Supabase
   migration. Keep the existing `claimed_at` and `voided_at` fields; each marks
   a different event.
2. Backfill only trusted historical payment timestamps. If no reliable payment
   event exists, leave `paid_at` null rather than using `arrival_time`,
   `updated_at`, or `claimed_at` as a guess.
3. Extend `TransactionRow`, the transaction select lists, and the `Transaction`
   client type with `paidAt` / `paid_at`.
4. Include the field in repository mappings, mock records, REST responses, and
   Supabase Realtime mappings so all clients receive the authoritative value.

## Transaction State Transitions

1. **Create order:** default to `payment_status = unpaid` and `paid_at = null`.
2. **Mark paid:** when an unpaid order becomes paid, set `paid_at` to the server
   time exactly once. Later edits that keep it paid must retain the first value.
3. **Mark unpaid:** decide and document the reversal policy before allowing it.
   Recommended policy: only an administrator can reverse a payment, must supply
   a reason, and the reversal clears `paid_at` or creates a separate payment
   adjustment record. Do not permit ordinary staff toggles to rewrite revenue
   history silently.
4. **Claim:** accept only when the stored payment state, or the same atomic
   update's resulting state, is `paid`; set `claimed_at` once.
5. **Void:** exclude the order from recognized revenue. Preserve audit history
   and its void time/reason. If refunds are later supported, represent them as
   explicit negative adjustments rather than changing the original payment.

## Server and API Work

1. Update `lib/transaction-contracts.ts` with any required payment-transition
   input and validation shape.
2. In `lib/server/laundry-repository.ts`, calculate status/payment transitions
   from the existing row and write `paid_at`, `claimed_at`, and `voided_at` in
   one server-side update. Avoid client timestamps.
3. In `app/api/transactions/[ticketId]/route.ts`, reject `status: "Claimed"`
   if the effective payment status is unpaid. Return a clear 400 error.
4. Preserve existing auth, audit logging, cache invalidation, mock mode, and
   realtime behavior. Add audit details for payment confirmation/reversal and
   claim rejection where appropriate.
5. Update Claim Verification so the paid action is saved successfully before
   enabling claim; its existing combined paid-and-claim action remains valid if
   the server treats it atomically.

## Reporting Changes

1. In `components/pages/reports.tsx`, derive a `recognizedRevenueTransactions`
   collection: `paymentStatus === "paid"`, `paidAt` is inside the selected
   report range, and `status !== "Voided"`.
2. Use that collection for Sales Analytics cards, total revenue, average order
   value, service mix, and the sales trend chart. Bucket the trend by `paidAt`,
   not `dropOffDate`.
3. Keep the current period controls; their date range now filters payment dates
   for Sales Analytics. The Transactions/Daily Summary views can continue to
   filter by `dropOffDate`, as they describe operations rather than cash sales.
4. Make the UI labels unambiguous: use `Collected Revenue`, `Paid Orders`, and
   `Payment Date`. Show unpaid balances separately as `Outstanding`.
5. Retain a separate status/fulfilment chart if useful, but label it as order
   status rather than sales. Exclude voided orders from revenue and state this
   in exports.
6. Update the Analytics export to use the same paid, non-voided, payment-date
   dataset as the on-screen analytics. Transaction exports should still include
   all transactions and their current payment/status fields.

## Dashboard Alignment

The dashboard's paid-revenue card already filters for paid, non-voided orders.
Update it to use `paidAt` for time-filtered variants and rename it to
`Collected Revenue` where that improves clarity. It should agree with Sales
Analytics for the same payment-date range.

## Tests

1. Paying an unpaid order assigns one server-generated `paid_at` value.
2. Re-saving an already paid order preserves its original `paid_at` value.
3. An unpaid claim request is rejected by the API even if it bypasses the UI.
4. An atomic paid-and-claim request succeeds and sets both timestamps once.
5. A paid, unclaimed order appears in Sales Analytics on its payment date.
6. Claiming that order later does not duplicate or move revenue.
7. An unpaid order does not appear in recognized revenue but contributes to
   Outstanding.
8. A voided order is excluded from recognized revenue, charts, and analytics
   exports.
9. Analytics period filters and exports produce the same totals for the same
   payment-date range.
10. Reload and a second session receive consistent payment and claim timestamps
    through the normal repository/Realtime path.

## Manual Acceptance Check

1. Create an unpaid order today; verify it appears as Outstanding, not
   Collected Revenue.
2. Mark it paid; verify its fee immediately appears in today's Sales Analytics
   and that a payment timestamp is retained after reload.
3. Claim it tomorrow; verify the revenue remains assigned to today's payment
   date while the operational status becomes Claimed.
4. Attempt to claim another unpaid Ready order through both the UI and a direct
   API request; both must be rejected.
5. Void a paid test order and verify it is excluded from collected-revenue
   totals and analytics exports, while its audit trail remains visible.

## Verification Commands

- `npm run lint`
- `npm run build`
- Relevant route, repository, and reports component tests
- Two-session manual verification with Supabase configured
