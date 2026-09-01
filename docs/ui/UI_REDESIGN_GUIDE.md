# LaundryTrackv2 — Safe UI Redesign Guide & Prompt Playbook

> Goal: Completely transform the visual look and feel without altering business logic, API integrations, or state management. New design, same functionality.

---

## 1. Core Philosophy — Separation of Concerns

| Layer | What it is | Examples | Can you change it? |
|---|---|---|---|
| **Logic / Engine** | How the app *works* — data, state, events | `useState`, `useEffect`, Supabase calls, `onClick`/`onSubmit`/`onSave`, Zod schemas, `lib/*-contracts.ts` | **NO — preserve exactly** |
| **Presentation / Body** | How the app *looks* — markup & style | JSX structure, Tailwind classes, colors, fonts, icons, layout, `components/ui/*` styling | **YES — redesign freely** |

**Rule:** Keep the logic variables/handlers intact, delete/replace only the HTML + Tailwind wrapper around them.

- Old: `<button onClick={handleSave} className="old-btn">Save</button>`
- New: `<NewButton onClick={handleSave} variant="primary">Save</NewButton>` — same handler, new look.

---

## 2. Safest Thing Before Changing Anything

1. **Create a git branch** — never edit `main` directly:
   ```bash
   git checkout -b feature/ui-redesign
   ```
2. **Baseline test** — run `pnpm dev` and verify these still work *before* you touch styles:
   - Login / page navigation
   - Open/close Transaction Edit Modal (X, Cancel, outside click, ESC)
   - Light ↔ Dark mode toggle
   - Dashboard charts + Recent Transactions table
   - PDF export / Print receipt preview
3. **Work incrementally** — one primitive or one page at a time, commit after each.

---

## 3. Project-Specific Critical Watchouts

### 3.1 Dark Mode (`app/globals.css` + `dark:` classes)
- Custom OKLCH slate palette: `#0f172a` (bg), `#1e293b` (card), `#334155`/`#475569` (borders), `#f1f5f9`/`#94a3b8` (text).
- Custom overrides for Recharts grid/tooltip and `dark:bg-opacity-20` icon backgrounds.
- **Risk:** Dropping `dark:` variants makes dark mode unreadable.
- **Rule:** Test every redesigned component in both themes; keep CSS variables in `app/globals.css`.

### 3.2 App Shell (`components/app-shell.tsx`)
- Central state for `activePage`/`setActivePage`, sidebar collapse, notifications, global modals.
- **Risk:** Replacing sidebar/mobile nav without `setActivePage()` breaks navigation.
- **Rule:** Keep page-switching logic and global modal mounts (`TransactionEditModal`, `PrintReceiptModal`).

### 3.3 Modals (`components/transaction-edit-modal.tsx`)
- Uses Radix Dialog with `onOpenChange`, `onPointerDownOutside`, and `hasChanges` unsaved-changes guard.
- **Risk:** Generic modal replacement loses close/confirm behavior.
- **Rule:** Preserve all close paths + `onSave` async flow.

### 3.4 Specialized Widgets (keep refs/DOM intact)
- `components/qr-scanner.tsx` — keep `<video>`/`<canvas>` refs + scan loop.
- `components/peak-hours-chart.tsx` — keep `<ResponsiveContainer>` + Recharts data keys.
- `components/print-receipt-modal.tsx` — keep `@media print` classes.
- `components/report-pdf.tsx` — `@react-pdf/renderer` styles (not Tailwind).

### 3.5 Forms (`lib/*-contracts.ts` + `react-hook-form` + `zod`)
- **Risk:** Swapping `<input>`/`<select>` without re-attaching `register()`, `value`/`onChange`, and error messages.
- **Rule:** Re-wire every new input to its existing binding.

---

## 4. Complete UI Inventory — Use to Cross-Examine Against New Design Repo

### 4.1 Pages & Views (`components/pages/` + `app/`)
- [ ] `components/pages/dashboard.tsx` — KPI summary cards, Recent Transactions table, Peak Hours chart
- [ ] `components/pages/transactions.tsx` — full data table, status/payment filters, search, row actions
- [ ] `components/pages/processing.tsx` — queue steps (Washing → Drying → Folding → Ready)
- [ ] `components/pages/claim-verification.tsx` — ticket lookup, QR validation
- [ ] `components/pages/loyalty.tsx` — stamp cards, members, rewards
- [ ] `components/pages/reports.tsx` — revenue analytics, date filters, PDF export
- [ ] `components/pages/staff-management.tsx` — staff table, role badges, permissions
- [ ] `components/pages/settings.tsx` — business profile, pricing, receipt settings
- [ ] `components/pages/profile.tsx` — avatar upload, account details
- [ ] `components/pages/audit-logs.tsx` — activity history
- [ ] `components/pages/data-import.tsx` — CSV upload + mapping
- [ ] `components/pages/login.tsx` + `staff-login.tsx` — auth cards
- [ ] `components/pages/register.tsx` — signup form
- [ ] `components/pages/forgot-password.tsx` + `change-password.tsx`
- [ ] `app/track/[token]/page.tsx` — public customer tracker (no auth)
- [ ] `app/offline/page.tsx` — PWA offline fallback

### 4.2 Shell & Global Navigation (`components/`)
- [ ] `components/app-shell.tsx` — root orchestrator
- [ ] `components/sidebar.tsx` — desktop nav with badges/logo
- [ ] `components/topnav.tsx` — header, breadcrumbs, notifications, theme toggle, avatar menu
- [ ] `components/mobile-bottom-nav.tsx` — mobile bottom bar
- [ ] `components/theme-provider.tsx` — `next-themes` wrapper
- [ ] `components/offline-access-notice.tsx` — offline banner
- [ ] `components/sync-status-detail.tsx` — sync indicator
- [ ] `components/pwa-init.tsx` — service worker

### 4.3 Modals & Drawers (`components/`)
- [ ] `components/transaction-edit-modal.tsx` — universal edit modal
- [ ] `components/transaction-detail-modal.tsx` — read-only detail view
- [ ] `components/print-receipt-modal.tsx` — thermal receipt (print styles)
- [ ] `components/status-update-sheet.tsx` — mobile status drawer

### 4.4 Specialized Widgets (`components/`)
- [ ] `components/peak-hours-chart.tsx` — Recharts bar chart
- [ ] `components/qr-scanner.tsx` — camera scanner
- [ ] `components/report-pdf.tsx` — PDF template

### 4.5 Base UI Primitives (`components/ui/` — shadcn + Radix)
- **Buttons/Badges:** `button.tsx`, `button-group.tsx`, `badge.tsx`, `toggle.tsx`, `toggle-group.tsx`, `kbd.tsx`
- **Forms/Inputs:** `input.tsx`, `input-group.tsx`, `input-otp.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `slider.tsx`, `calendar.tsx`, `form.tsx`, `field.tsx`, `label.tsx`
- **Containers/Layout:** `card.tsx`, `table.tsx`, `tabs.tsx`, `accordion.tsx`, `collapsible.tsx`, `scroll-area.tsx`, `separator.tsx`, `resizable.tsx`, `aspect-ratio.tsx`, `breadcrumb.tsx`, `pagination.tsx`, `carousel.tsx`, `chart.tsx`
- **Overlays/Feedback:** `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `drawer.tsx`, `popover.tsx`, `hover-card.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `command.tsx`, `alert.tsx`, `toast.tsx`, `toaster.tsx`, `sonner.tsx`
- **Status/Display:** `avatar.tsx`, `progress.tsx`, `spinner.tsx`, `skeleton.tsx`, `empty.tsx`, `item.tsx`

### 4.6 Global Styling
- [ ] `app/globals.css` / `styles/globals.css` — Tailwind v4 tokens + chart overrides
- [ ] `components.json` — shadcn config (`new-york`, `neutral`, `lucide`)

### 4.7 Recently Added / High-Churn Features — Detailed Cross-Check

> Added in `codex/foreast` merge (reports forecast + loyalty history + settings persistence). Verify these exist 1:1 in the new design repo.

#### A. Reports Page — `components/pages/reports.tsx` + `components/report-pdf.tsx`
- [ ] **Tab bar** — 5 tabs: `Daily Summary` | `Sales Analytics` | `Forecast` | `Unclaimed Items` | `Export` (`Tabs`, `TabsList`, `TabsTrigger`)
- [ ] **Daily Summary tab** — 4 summary cards (Total Transactions, Total Revenue, Total Weight, Ready for Pickup) + date picker (`Popover` + `Calendar`) + transactions table (columns: Ticket ID, Customer, Arrival, Service, Weight, Fee, Status) with mobile card layout
- [ ] **Sales Analytics tab** — period presets `Day`/`Week`/`Month`/`Year` (buttons switch `rangePreset`) + 4 KPI cards (Sales in Range, Orders in Range, Average Order Value, Peak Claim Window) + Sales Trend `BarChart` + Market/Sales Mix `PieChart` (service mix, paid/unpaid split, status distribution, peak analysis cards) + Service Revenue Table (mobile cards / desktop table)
- [ ] **Forecast tab (NEW)** — header with `ForecastRange` select (`7d`/`30d`/`3m`/`6m`/`custom` → `getForecastRangeDates`) + `Export Forecast Report` button (`downloadForecastReportPdf`, `forecastPdfGenerating`) + conditional custom date range pickers + 4 metric cards (Best Day to Staff Up / Peak Drop-off Time / Busiest Week / Weather Impact) + `Predicted Busy Days` vertical `BarChart` (highlight `BUSY_BAR` vs `NORMAL_BAR`, footer badges busiest/slowest) + `Predicted Peak Hours` horizontal `BarChart` (highlight peak window) + `Monthly Customer Trend` `LineChart` (6-month trend, `trendPercent`) + insight text + `BUSY_BAR`/`NORMAL_BAR`/`MUTED_BAR` color constants — preserve `buildForecastMetrics`, `getPeakWindows`
- [ ] **Unclaimed Items tab** — `Ready` filter table
- [ ] **Export tab** — checkboxes for `Transactions` / `Sales and Analytics` / `Customers`, format toggle `pdf`/`csv`, handlers `handleCsvExport` / `handlePdfExport` (`downloadReportPdf`)
- [ ] **PDF templates** — `report-pdf.tsx` exports `downloadReportPdf` + `downloadForecastReportPdf` (`@react-pdf/renderer`); keep import paths when restyling

#### B. Loyalty Page — `components/pages/loyalty.tsx` (`hooks/use-loyalty-members.ts`, `/api/loyalty*`)
- [ ] **Disabled banner** — conditional `!loyaltyEnabled` yellow `AlertTriangle` banner
- [ ] **Search + Add Member** — `Search` input (name/phone filter) + `Add Member` button → `Dialog` (Name/Phone/Preferences, `handleAddMember`, `getAuthHeaders`)
- [ ] **Summary card** — Total Members count
- [ ] **Members list/table** — desktop `table` (Name, Phone, Stamps w/ `Star`, Rewards Redeemed, Date Joined, View/Edit/Delete) + mobile card layout; rows wired to `handleSelectMember` (fetch `/api/loyalty/${id}`), `setEditModal`, `setDeleteModal`
- [ ] **Member detail view** (`selected` state) — Back button + Profile `Card` (avatar `Star`, stamp count, rewards, `Add Stamps` button, preferences) + Current Cycle Progress `Card` (`StampDots` 10-dot row, history tables filtered to `currentCycleStamps = stampCount % washesPerReward`) + Reward History table (rows clickable → `rewardCycleModal` `Dialog` with cycle visits + summary)
- [ ] **Modals** — Edit Member `Dialog`, Delete `AlertDialog`, Add Stamps `Dialog` (stamps number + reason, `handleAddStamps` → `/api/loyalty/${id}/stamps`), Reward Cycle `Dialog`; preserve `useLoyaltyMembers().refetch()` + `toast` + `saving` disables

#### C. Settings Page — `components/pages/settings.tsx` (`lib/settings-store.ts`, `/api/settings/pricing`, `/api/settings/business-profile`, `lib/offline-settings-sync.ts`)
- [ ] **PricingSettings — Base Pricing card** — `PricingMode` toggle 3 buttons (Per Kilogram / Per Load / Both with `Scale`/`ShoppingBasket`/`Package` icons) → conditional Per-Kg fields (`pricePerKg`, `minWeight` numeric sanitized) + Per-Load tier table (editable Load Size name, Weight Range From/To + open-ended `Open` toggle, Price, delete `Trash2` → confirm dialog) + Undo/Redo tier history (`Undo2`/`Redo2`) + Add Custom Tier panel (`buildRange`/`parseRange`)
- [ ] **Service Types card** — helper text + enabled `Switch` (`laundrytrack_svc_enabled`) + service rows (name, description, price badge, pricing type badge, Show/Price toggles, Edit `Edit` → `Dialog`, Delete `Trash2`) + Add Service Type form (name/desc/price/pricingType/ShowInTxn/ShowPrice) + Edit `Dialog` (`svcEdit*` state)
- [ ] **Add-on Rates card** — list + add row (name + rate ₱ + `Plus`)
- [ ] **Price Display Settings card** — 3 modes `Show Price` (`Eye`) / `No Price / Free` (`Tag`) / `Hide Price` (`EyeOff`) — `PriceDisplayMode` buttons
- [ ] **Floating Save** — fixed bottom `Save Changes` button + `CheckCircle2` "Changes saved!" toast; `handleSave` persists via `persistPricingConfig`/`persistAddOns`/`persistServiceTypes` + `PUT /api/settings/pricing` (queues via `enqueueSettingsMutation` when offline) — preserve `isOnline` branch
- [ ] **BusinessProfileSettings** — shop name/tagline/address/contact/email/logo upload (`logoDataUrl`), receipt footer, pickup instructions; dirty check `isDirty`, `saveError`, reset confirm — keep `buildAuthHeaders` + Supabase browser client wiring
- [ ] **Offline sync** — `enqueueSettingsMutation`, `isOnline` guard visible in save flows; do not remove when restyling cards/buttons
- [ ] **Cross-check in new repo:** every editable table row, inline switch, numeric sanitizer (`replace(/[^0-9.]/g,'')`), and PUT queue path must have an equivalent

---

## 5. Phased AI Prompt Playbook (Copy-Paste)

### Why these prompts exist
Without guardrails, AI will: (1) truncate long files with `// ...rest of code`, dropping buttons/filters; (2) strip `onClick`/`value`/`onChange` when swapping markup; (3) delete hidden logic (modal close guards, print styles, QR refs, dark mode); (4) change too much at once making bugs unfindable. These prompts force the AI to preserve logic and work incrementally.

### Prompt 0 — Master Guardrails (send FIRST, get confirmation)
```markdown
You are an expert Frontend Engineer redesigning this app (Next.js 15, React 19, Tailwind CSS v4, shadcn/ui, TypeScript).

STRICT NON-NEGOTIABLE RULES:
1. PRESERVE ALL BUSINESS LOGIC: Do not alter, rename, or delete any useState, useEffect, custom hooks, Supabase calls, or handlers (onClick, onChange, onSubmit, onSave).
2. ZERO FEATURE LOSS: Every button, filter, table column, modal trigger, and data display must remain.
3. DARK MODE: Every new component must support Light + Dark via Tailwind dark: classes / CSS variables.
4. FORM BINDINGS: Preserve react-hook-form register(), Zod schemas, and error messages.
5. TYPE SAFETY: No `any`. Keep full TypeScript compliance with lib/* contracts.
6. MODAL SAFETY: Preserve onOpenChange, ESC, backdrop click, and unsaved-changes confirmation.

Confirm you understand. Do not edit files until I give a specific target.
```

### Prompt 1 — Global Tokens & Base Primitives
```markdown
Task: Update design tokens and base UI primitives to match new design system.

New Design Reference / Theme Specs:
[PASTE color codes, border-radius, typography, shadows HERE]

Target Files:
- app/globals.css (or styles/globals.css)
- components/ui/button.tsx
- components/ui/card.tsx
- components/ui/badge.tsx
- components/ui/input.tsx

Requirements:
1. Update CSS variables in globals.css with WCAG AA contrast in light + dark.
2. Update Tailwind classes inside targeted components/ui/* primitives.
3. Do NOT change prop interfaces (variant, size, className, disabled, children).
```

### Prompt 2 — Shell & Navigation
```markdown
Task: Redesign Layout Shell and Navigation.

Target Files:
- components/app-shell.tsx
- components/sidebar.tsx
- components/topnav.tsx
- components/mobile-bottom-nav.tsx

New Design Specs / Code:
[PASTE new sidebar/header JSX or screenshot description HERE]

Constraints:
1. Keep activePage / setActivePage(...) switching exactly.
2. Keep notification popover, avatar menu, theme toggle.
3. Keep mobile bottom nav synced to activePage.
4. Keep global modal mounts (TransactionEditModal, PrintReceiptModal) in app-shell.tsx.
```

### Prompt 3 — Page-by-Page Migration (reuse per page)
```markdown
Task: Redesign components/pages/[PAGE_NAME].tsx (e.g. dashboard.tsx).

Current File: components/pages/[PAGE_NAME].tsx
New UI Reference:
[PASTE new JSX / screenshot description HERE]

Steps:
1. Inventory all state hooks, data fetching, and handlers in the current file.
2. Replace JSX layout with new design using updated components/ui/* primitives.
3. Reconnect every handler/binding: table fields, search/filter states, button onClicks, loading skeletons, empty states.
4. No TypeScript errors, no missing imports.
```

### Prompt 4 — Modals & Specialized Widgets
```markdown
Task: Restyle components/[WIDGET_NAME].tsx without breaking its mechanics.

Target: components/[WIDGET_NAME].tsx (e.g. transaction-edit-modal.tsx / print-receipt-modal.tsx / peak-hours-chart.tsx / qr-scanner.tsx)

Requirements:
1. Modals: keep hasChanges guard, onPointerDownOutside, onOpenChange, handleSave async flow.
2. Charts: keep <ResponsiveContainer> + data keys; only recolor/style tooltips.
3. Print: keep @media print classes.
4. QR: keep <video>/<canvas> refs + scan loop.
5. Style only containers/headers/buttons/badges.
```

### Prompt 5 — Verification & Safety Audit (run after each page)
```markdown
Task: Regression + type audit for [FILE_PATH].

Checklist:
1. tsc --noEmit → zero errors.
2. No deleted/unlinked buttons, fields, or state bindings vs. original.
3. dark: classes present for text/bg/border.
4. Responsive at mobile/tablet/desktop.
Report discrepancies.
```

---

## 6. Recommended Execution Order

1. Branch + baseline test
2. Prompt 0 (guardrails) → Prompt 1 (tokens + button/card/badge/input)
3. Prompt 2 (shell/nav)
4. Prompt 3 loop: `dashboard` → `transactions` → `processing` → `claim-verification` → `loyalty` (verify 4.7.B) → `reports` (verify 4.7.A forecast + 5-tab bar + both PDF exports) → `staff-management` → `settings` (verify 4.7.C tiers/services/add-ons/price modes + offline queue) → `profile` → `audit-logs` → `data-import` → `login/register/password` → `track/[token]` / `offline`
5. Prompt 4 for modals/widgets as needed (QR `video`/`canvas` refs, `print-receipt-modal` `@media print`, `report-pdf` templates)
6. Prompt 5 after each file + commit (`git commit -m "style: redesign [page]"`)

---

## 7. Tips for Best AI Results
- Paste the new design's JSX for the target component into the prompt — don't rely on vague descriptions.
- Limit each prompt to 1–2 files.
- Commit after each page so you can bisect regressions.
