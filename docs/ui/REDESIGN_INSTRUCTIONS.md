# UI Skin-Only Redesign — Persistent Instructions

> This file is the permanent rulebook for the UI redesign. Read it before every redesign session/work packet. It complements `UI_REDESIGN_GUIDE.md` (inventory + prompts); where they overlap, this file's rules win.

---

## 1. Core Directive: SKIN ONLY — No Flow Changes

The reference screenshots in `reference_image/` are used **strictly as a visual skin** (the brown-themed look). They are NOT a blueprint for layout, navigation, or workflow.

| Rule | Meaning |
|---|---|
| **Flow is source of truth** | The current app's pages, steps, modals, buttons, filters, table columns, and interactions stay EXACTLY as they are. If the screenshot's flow differs from ours, ours wins — silently. |
| **Ask-before-touch gate** | If an element cannot be re-skinned without changing its structure/behavior (e.g. a layout that physically cannot hold the new skin), STOP and ask the user: "this may affect flow — keep current or adopt?" Default = keep current. User confirms case by case. |
| **Same functions** | Every button, handler, state, form binding, and data display must survive the redesign 1:1. |

### Non-negotiable technical guardrails (from `UI_REDESIGN_GUIDE.md`)
1. PRESERVE ALL BUSINESS LOGIC — no renaming/removing `useState`, `useEffect`, hooks, Supabase calls, handlers.
2. ZERO FEATURE LOSS — every button, filter, column, modal trigger remains.
3. DARK MODE — every re-skinned component must work in Light + Dark.
4. FORM BINDINGS — `react-hook-form` `register()`, Zod schemas, error messages intact.
5. TYPE SAFETY — no `any`; `tsc --noEmit` passes.
6. MODAL SAFETY — `onOpenChange`, ESC, backdrop click, unsaved-changes guards intact.
7. SPECIAL WIDGETS — QR `<video>`/`<canvas>` refs, Recharts `<ResponsiveContainer>` + data keys, `@media print` classes, `@react-pdf/renderer` styles all preserved.

---

## 2. Reference Images — Usage Rules

Location: `reference_image/` (dashboard, new order 1-3, receipt, processing, records, claimed, verify, rewards, members, reports, staff/audit, settings, business profile).

- Extract: colors, typography mood, borders, textures, radii, shadows.
- Ignore: page structure, step ordering, navigation patterns, feature sets.
- **Model limitation:** the primary working model cannot view images. Palette values must come from the user (hex codes) or be proposed by the agent and explicitly confirmed by the user before Phase 1. Record the confirmed palette in Section 4 and never guess beyond it.

---

## 3. Phase-by-Phase Plan (one phase = one tab/page/section)

Workflow per phase: **build → user checks → user approves → next phase.** Never start a new phase without explicit user approval of the previous one.

| Phase | Scope | Files | Reference image | Check gate |
|---|---|---|---|---|
| **1. Foundation** | Design tokens (brown palette) + base primitives (`button`, `card`, `badge`, `input`, `table`, etc.) + app shell (`app-shell`, `sidebar`, `topnav`, `mobile-bottom-nav`) | `app/globals.css`, `components/ui/*`, `components/app-shell.tsx`, `components/sidebar.tsx`, `components/topnav.tsx`, `components/mobile-bottom-nav.tsx` | dashboard.png (skin only) | App frame brown-skinned; nav works; both themes OK |
| **2. Dashboard** | KPI cards, Recent Transactions table, Peak Hours chart | `components/pages/dashboard.tsx` (+ `peak-hours-chart.tsx` recolor) | dashboard.png, dashboard 2.png | All KPIs, table, chart render with live data |
| **3. Transactions / New Order** | New order flow + records list + claimed records + receipt modal | `components/pages/transactions.tsx`, `components/print-receipt-modal.tsx` | neworder.png, new order step2.png, neworderstep3.png, recordstrnsac.png, recordsclaimed.png, receiptneworder.png | New order flow unchanged step-by-step; print still works |
| **4. Processing** | Queue steps (Washing → Drying → Folding → Ready) | `components/pages/processing.tsx`, `components/status-update-sheet.tsx` | processing.png | Queue drag/actions unchanged |
| **5. Claim Verification** | Ticket lookup, QR validation | `components/pages/claim-verification.tsx`, `components/qr-scanner.tsx` | verify.png | QR scan loop intact |
| **6. Loyalty (Members & Rewards)** | Members list, stamp cards, reward history, modals | `components/pages/loyalty.tsx` | rewards.png, members and reward.png, members and reward step2.png | Stamps/rewards/add-member flows unchanged |
| **7. Reports** | 5 tabs incl. Forecast, PDF exports | `components/pages/reports.tsx`, `components/report-pdf.tsx` | reports.png | All 5 tabs + both PDF exports work |
| **8. Staff Management & Audit Logs** | Staff table, role badges; activity history | `components/pages/staff-management.tsx`, `components/pages/audit-logs.tsx` | staff and audit.png, audit.png | Role/permission UI unchanged |
| **9. Settings & Business Profile** | Pricing, service types, add-ons, price display modes, profile | `components/pages/settings.tsx` | setting.png, bussinessprofile.png | Tier editor, offline queue, save flow unchanged |
| **10. Secondary pages** | Profile, Data Import, Login/Register/Password, public `track/[token]`, `offline` | remaining `components/pages/*`, `app/track/[token]/page.tsx`, `app/offline/page.tsx` | bussinessprofile.png (skin only) | Auth + public tracker unchanged |
| **11. Final sweep** | Cross-examination vs `UI_REDESIGN_GUIDE.md` §4 inventory; dark mode + responsive + type audit | all | — | Zero feature loss confirmed by user |

Per-phase verification (before asking user to check):
- [ ] `tsc --noEmit` — zero errors
- [ ] No deleted/unlinked buttons, fields, or state bindings vs. original
- [ ] `dark:` classes present for text/bg/border
- [ ] Responsive at mobile/tablet/desktop
- [ ] Commit only after user approves the phase (`style: redesign <phase>`)

---

## 4. Confirmed Design Tokens (fill after user confirms palette)

> DO NOT invent values here. Populated only with user-confirmed hex codes.

```css
/* DRAFT — awaiting user confirmation (model cannot read reference images) */
--background:      /* TBD by user */
--foreground:      /* TBD by user */
--card:            /* TBD by user */
--primary:         /* TBD by user — brown accent */
--muted:           /* TBD by user */
--border:          /* TBD by user */
```

---

## 5. Session Memory

Any agent resuming this work must:
1. Read this file fully.
2. Run `git log --oneline -5` to see which phases are already committed (commit messages follow `style: redesign <phase>`).
3. Ask the user which phase is next — never batch phases without approval gates.
