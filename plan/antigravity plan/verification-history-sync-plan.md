# Verification History Database Sync Implementation Plan

## Objective

Make Claim Verification history show the newest QR scan, claim, and denial activity immediately; persist it to Supabase `audit_logs`; and synchronize it across reloads and staff devices using direct Supabase Realtime reconciliation and optimistic UI.

## Context & Root Cause

Currently, `components/pages/claim-verification.tsx`:
1. Initializes `logs` from `initialLogs` (static mock array from `@/lib/data` dated April 4-5, 2026).
2. Appends scan/claim/denial actions only to local React state via `addLog()`, never saving scans or denials to the database.
3. Does not listen to Supabase Realtime for `audit_logs`.
4. Navigating away or reloading clears all scan/claim actions, reverting to the 5 static mock entries.
5. Counter staff accounts cannot even fetch `/api/audit-logs` because it requires admin privileges (`requireAdminRequest`).

## Required Architecture & Data Flow

```text
Staff scans QR, confirms claim, or denies claim
  │
  ├─► 1. Optimistic UI: Prepend pending row to Verification History immediately
  │      (with clientCorrelationId & isPending flag)
  │
  ├─► 2. Authenticated Persistence:
  │      - Scan & Denial: POST /api/audit-logs with correlationId
  │      - Claim: PATCH /api/transactions/[ticketId] records action: "claim_verified"
  │
  ├─► 3. Supabase Realtime:
  │      - Emits postgres_changes INSERT on public.audit_logs
  │      - Direct reconciliation in useAuditLogs():
  │        * Match clientCorrelationId -> replace optimistic row with database row
  │        * Deduplicate by id -> ignore if already present
  │        * Other staff sessions receive the INSERT and prepend the row instantly
  │
  └─► 4. Resilience:
         - On network/server failure: optimistic row is rolled back / marked unsaved
         - On reconnect / window focus: safe background refresh reconciles state
```

---

## Detailed Step-by-Step Implementation

### Step 1: Types & Contracts (`lib/audit-log-contracts.ts` & `lib/server/audit-log-repository.ts`)
- Update `AuditActionType` to include `"claim_scanned"`, `"claim_denied"`, and `"transaction_voided"`.
- Update `KNOWN_ACTIONS` in `lib/server/audit-log-repository.ts` to recognize these actions.
- Update `AuditLogEntry` to optionally support `clientCorrelationId?: string` and `isPending?: boolean`.

### Step 2: Staff Authorization & Server Persistence (`app/api/audit-logs/route.ts`)
- Change `GET /api/audit-logs` from `requireAdminRequest` to `requireAuthRequest` so counter staff can view audit logs.
- Add `POST /api/audit-logs`:
  - Enforce `requireAuthRequest(request)` (staff or admin).
  - Validate body: `action`, `ticketId`, `summary`, `details`, `customerName`, `paymentStatus`, `correlationId`.
  - Persist to Supabase via `createAuditLog()`.
  - Return HTTP 201 with the created `AuditLogEntry`.

### Step 3: Authoritative Claim Audit Event (`app/api/transactions/[ticketId]/route.ts`)
- When `body.status === "Claimed"`:
  - Record audit log with `action: "claim_verified"`.
  - Summary: `Verified claim for ${transaction.ticketId}`.
  - Details: `Customer: ${transaction.customerName} | Payment: ${transaction.paymentStatus} | Item released at counter`.
  - Ensure it is properly saved to `audit_logs` before returning.

### Step 4: Direct Realtime Reconciliation & Optimistic Mutator in `hooks/use-audit-logs.ts`
- Extend `useAuditLogs()` with:
  - Direct Realtime `INSERT` event handling:
    - Map `payload.new` to `AuditLogEntry`.
    - If `payload.new.metadata?.correlationId`, replace the optimistic entry matching that correlation ID.
    - Prevent duplicate insertions if row ID already exists.
    - Prepend new entries directly to state without doing a heavy full re-fetch.
    - Fallback full refresh on reconnect or malformed payload.
  - Expose `logVerificationEvent(input)`:
    - Optimistically prepends pending entry with `clientCorrelationId`.
    - Calls `POST /api/audit-logs`.
    - Replaces pending entry with confirmed server entry on response.
    - Rolls back / marks unsaved on failure.

### Step 5: Connect `ClaimVerificationPage` to Live Audit Logs
- Replace `const [logs, setLogs] = useState<AuditLog[]>(initialLogs);` in `components/pages/claim-verification.tsx`:
  - Use `useAuditLogs()` to read live audit logs.
  - Filter `auditLogs` for verification activity (`claim_scanned`, `claim_verified`, `claim_denied`, `override`, or relevant transaction status claims).
  - Only fall back to `initialLogs` if `usingSupabase` is false (offline/demo mode).
  - On QR scan: call `logVerificationEvent({ action: "claim_scanned", ticketId, ... })`.
  - On Deny: call `logVerificationEvent({ action: "claim_denied", ticketId, notes: denyReason, ... })`.
  - When ticket is already claimed: also log a scan attempt if appropriate, showing notice.
  - Display pending status spinner or indicator on optimistic rows.

### Step 6: Automated Tests & Verification
- Unit tests in `app/api/audit-logs/__tests__/route.test.ts`:
  - Verify GET allows staff (`requireAuthRequest`)
  - Verify POST creates audit log and returns `AuditLogEntry` with correlationId
- Hook tests in `hooks/__tests__/use-audit-logs-realtime.test.ts`:
  - Immediate optimistic entry creation with correlation ID
  - Direct Realtime `INSERT` event prepends row
  - Deduplication prevents duplicate entries when Realtime delivers the persisted optimistic event
  - Safe full refresh triggered on malformed Realtime payload
  - Rollback / unsaved handling on failed POST
- Component tests in `components/__tests__/claim-verification.test.tsx`:
  - Verify QR scan appears as newest row immediately
  - Verify confirmed claim creates claim event and removes ticket from Processing
  - Verify denial appears as newest row immediately
  - Verify data is backed by authoritative audit logs rather than static mock initialLogs

---

## Codex Plan Alignment Matrix

| Codex Requirement | Our Implementation |
|---|---|
| **1. Database Persistence** | Authenticated `POST /api/audit-logs` endpoint + `claim_verified` event on transaction claim in `api/transactions/[ticketId]`. |
| **2. Immediate History Updates** | Optimistic pending row prepended immediately to history with subtle pending status; confirmed upon server/Realtime arrival. |
| **3. Realtime Synchronization** | Direct `INSERT` listener on `public.audit_logs` in `useAuditLogs()` propagates new events to all open staff sessions without reloading. |
| **4. Duplicate Prevention** | Client correlation ID (`clientCorrelationId`) and database `id` deduplication ensure optimistic rows are replaced, never duplicated. |
| **5. Regression Tests** | All 6 regression tests specified by Codex covered in Vitest test files. |
| **6. Manual Acceptance Checks** | Two-session manual verification protocol outlined below. |

---

## Regression Tests (Codex Suite)
1. A successful QR scan appears as the newest Verification History row immediately.
2. Reloading Claim Verification retains the scan because it was stored in `audit_logs`.
3. A scan, claim, or denial from another session appears once in the current session.
4. A successful claim removes the ticket from Processing and adds exactly one claim history row.
5. A failed audit write removes or marks the optimistic history row as unsaved.
6. A malformed Realtime audit payload triggers one safe refresh without corrupting history.

## Manual Acceptance Checklist
1. Open Claim Verification in two authenticated staff browser sessions (Session A & Session B).
2. Scan a valid Ready ticket in Session A; confirm its `Scanned` row appears first immediately in A and then in B.
3. Reload Session A; confirm the scan remains.
4. Mark the ticket claimed in Session A; confirm it disappears from Processing in both sessions and a single `Claimed` row appears in Verification History.
5. Deny another ticket; confirm the persisted `Denied` row appears once in both sessions.

