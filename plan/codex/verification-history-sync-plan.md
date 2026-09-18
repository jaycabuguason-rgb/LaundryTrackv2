# Verification History Database Sync Plan

## Objective

Make Claim Verification history show the newest QR scan, claim, and denial activity immediately; persist it to the database; and synchronize it across reloads and staff devices.

## Current Problem

`components/pages/claim-verification.tsx` starts its history with sample data and appends activities only to local React state. Those entries are temporary: they are not the database history, disappear on reload, and cannot arrive from another staff device.

## Required Data Flow

```text
Staff scans QR, confirms a claim, or denies a claim
  -> show a pending newest history row immediately
  -> persist the activity in public.audit_logs through an authenticated server path
  -> Supabase Realtime publishes the stored audit_logs row
  -> replace or deduplicate the pending row with the server row
  -> all open staff sessions show the same newest history
```

## Implementation Order

1. Verify the deployed `public.audit_logs` table is included in `supabase_realtime` and staff can read authorized audit rows.
2. Change Claim Verification to use the same authoritative audit-log source as the Audit Logs page; do not seed database-enabled history from `initialLogs`.
3. Add an authenticated server path to persist `Scanned` and `Denied` events. A browser-only `addLog()` call is not sufficient.
4. Ensure `Claimed` has a server-authoritative audit event before showing the claim flow as complete.
5. Add direct INSERT Realtime reconciliation in `useAuditLogs()`: prepend valid rows and deduplicate by database audit-log id. Use full refresh only for malformed events, reconnect, or focus recovery.
6. Add an optimistic pending row for scan and denial actions, with a client correlation id. Replace it with the matching persisted event so it cannot appear twice.
7. Run automated tests and verify two staff browser sessions manually.

## Files in Scope

- `components/pages/claim-verification.tsx`
- `hooks/use-audit-logs.ts`
- Authenticated audit-log API route or dedicated server action
- Audit-log hook and Claim Verification tests

## Rules

- The Verification History UI must use database-backed audit data whenever Supabase is configured.
- A successful claim must immediately remove the ticket from Processing and add its activity to Verification History.
- If persisting a scan or denial fails, remove its pending row or label it clearly as unsaved; never present it as confirmed history.
- Realtime confirmation of a locally-created audit row must replace it, not produce a duplicate.
- Do not use per-second polling. Realtime is primary; refresh on reconnect/focus is only a fallback.

## Regression Tests

1. A successful QR scan appears as the newest Verification History row immediately.
2. Reloading Claim Verification retains the scan because it was stored in `audit_logs`.
3. A scan, claim, or denial from another session appears once in the current session.
4. A successful claim removes the ticket from Processing and adds exactly one claim history row.
5. A failed audit write removes or marks the optimistic history row as unsaved.
6. A malformed Realtime audit payload triggers one safe refresh without corrupting history.

## Manual Acceptance Check

1. Open Claim Verification in two authenticated staff browser sessions.
2. Scan a valid Ready ticket in session A; confirm its `Scanned` row appears first immediately in A and then in B.
3. Reload session A; confirm the scan remains.
4. Mark the ticket claimed in session A; confirm it disappears from Processing in both sessions and a single `Claimed` row appears in Verification History.
5. Deny another ticket; confirm the persisted `Denied` row appears once in both sessions.
