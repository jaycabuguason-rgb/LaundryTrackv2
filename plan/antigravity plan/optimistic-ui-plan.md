# Optimistic UI — Instant Status Updates in Processing

The current Processing page shows a loading spinner and freezes the "Mark Ready" / "Start Wash" button while waiting for the server to respond (~500ms–2s). This makes it *feel* slow even though the server is doing its job fine.

The fix is **Optimistic UI** — a standard technique where the UI updates *instantly* on click, the server call runs silently in the background, and if the server fails the UI silently rolls back with a toast message.

> [!NOTE]
> The core plumbing for this already exists. `use-transactions.ts` already applies the optimistic update internally (lines 356–363). The Processing page just isn't taking advantage of it — it stalls waiting for the server before showing anything.

---

## How It Works Today vs After the Fix

**Before (current — slow):**
```
Click "Mark Ready"
  → button shows "Updating…" + disabled state
  → waits 500ms–2s for server round-trip
  → THEN card moves to Ready column
```

**After (optimistic — instant):**
```
Click "Mark Ready"
  → card moves to Ready column IMMEDIATELY (feels instant)
  → server call runs silently in background
  → if server fails → card moves back + toast "could not update, change reverted"
  → if server succeeds → nothing visible (already correct)
```

---

## Proposed Changes

### Processing Page

#### [MODIFY] [processing.tsx](file:///e:/sample%20project/LaundryTrackv2-pr-11/components/pages/processing.tsx)

**`applyStatusUpdate` function (lines 437–457)**
- Remove `async` / `await` — make it fire-and-forget
- Remove `setUpdatingTicket(txn.ticketId)` — no more blocking spinner
- Fire `onUpdateTransaction(...)` in the background using `.then()` / `.catch()`
- Show the success toast **immediately** (not after the server responds)
- On `.catch()`: show a rollback toast ("change was reverted") — the hook already rolls back the optimistic state automatically

**Button rendering — desktop table (lines 778–845)**
- Remove `disabled={isUpdating}` from the primary action button
- Remove `{isUpdating ? "Updating…" : nextAction.label}` — just use `nextAction.label` always
- Remove `disabled={isUpdating}` from the dropdown trigger button

**Button rendering — mobile cards (lines 651–680)**
- Remove `disabled={isUpdating}` from the mobile chevron button
- Remove `disabled={isUpdating}` from the mobile primary action button

**`updatingTicket` state (line 234)**
- Can be fully removed since nothing uses it after the above changes

> [!TIP]
> No changes needed in `use-transactions.ts` — the optimistic update is already there and working. We're just letting the Processing page *see* it immediately instead of waiting.

---

## What the User Experiences

| Action | Before | After |
|---|---|---|
| Click "Mark Ready" | Button freezes, shows "Updating…" for ~1s | Card moves instantly, button stays normal |
| Server succeeds | Card appears in Ready column | No visible change (already there) |
| Server fails / network error | Button unfreezes, nothing moved | Card snaps back + toast "change was reverted" |
| Click dropdown status | Same freeze | Instant move |
| Bulk update (Select All) | Waits for all server calls | Each card moves as its call fires |

---

## Verification Plan

### Automated Tests
- Run `pnpm test` to ensure existing tests still pass (no logic change in the hook)

### Manual Verification
1. Go to the Processing page with some transactions in "Washing" stage
2. Click **Mark Ready** on any ticket → card should move to Ready column instantly with no spinner
3. Click the dropdown **↓** → select a different status → should move instantly
4. Test with network throttled (DevTools → Network → Slow 3G) → card should still move instantly, server just catches up silently
5. Test with network offline → card moves instantly, then snaps back when the error resolves, toast appears

---

## Open Questions

None — the approach is straightforward and self-contained. Ready to implement on your go-ahead.
