# FreshSpin Features and Workflows

This file lists every feature and workflow found in the current code and in `UI_REDESIGN_GUIDE.md:1`. It is a plain list with no design opinions. Use it to check what exists and what a redesign must keep.

Related docs:
- Comparison against the redesign guide: `UI_CROSS_EXAMINATION.md:1`
- Redesign safety rules: `UI_REDESIGN_GUIDE.md:1`

---

## 1. Features by Area

### A. App Shell and Navigation

- Desktop sidebar (`components/sidebar.tsx:80`)
- Top header with breadcrumbs, notifications, theme toggle, avatar menu (`components/topnav.tsx:1`)
- Mobile bottom navigation (`components/mobile-bottom-nav.tsx:21`)
- Active page switching via `activePage` / `setActivePage` (`components/app-shell.tsx:89`)
- Page preload on hover (`components/app-shell.tsx:65`)
- Dark / light theme (`components/theme-provider.tsx:1`, `app/globals.css:1`)
- Offline banner (`components/offline-access-notice.tsx:1`) and sync detail (`components/sync-status-detail.tsx:1`)
- PWA service worker init (`components/pwa-init.tsx:1`)

### B. Authentication

- Admin login (`components/pages/login.tsx:1`)
- Staff login (`components/pages/staff-login.tsx:1`)
- Role selection (`app/page.tsx:26`)
- Register (`components/pages/register.tsx:1`)
- Forgot password (`components/pages/forgot-password.tsx:1`)
- Change password (`components/pages/change-password.tsx:1`)
- Profile page with avatar upload (`components/pages/profile.tsx:1`)
- Supabase session handling (`lib/supabase/browser-session.ts:1`, `app/page.tsx:137`)

### C. Dashboard

- Today's revenue, active orders, ready for pickup, total transactions
- Recent Transactions table (Ticket, Customer, Service, Status, Total)
- Peak Hours chart (`components/peak-hours-chart.tsx:1`)
- Role-based view (staff hides revenue) (`components/pages/dashboard.tsx:103`)
- View Board action to jump to Processing

### D. Processing / Order Board

- Stages: Received → Washing → Drying → Folding → Ready (see `components/pages/processing.tsx:1`)
- Stage counts and stage colors/icons
- Order ticket cards (customer, service, weight/load, payment, amount, notes)
- Move forward / move backward with disabled ends
- Empty stage state and status badge
- Detail view and edit routing (`components/app-shell.tsx:172`)

### E. Transactions

- Full dat search, status filter, payment filter (`components/pages/transactions.tsx:1`)
- Row actions: view detail, edit, print receipt, track
- Inline edit modal with unsaved-changes guard (`components/transaction-edit-modal.tsx:1`)
- Detail modal (read-only) (`components/transaction-detail-modal.tsx:1`)
- Status update sheet for mobile (`components/status-update-sheet.tsx:1`)
- Create transaction flow (still wired through transactions)

### F. New Order Wizard (FreshSpin inventory shape)

- Step 1: Customer info (name required, phone, email)
- Step 2: Service details (Per Kg / Per Load, service type, weight/load size, extras, notes, live price)
- Step 3: Summary (customer, service, extras, notes, total, Paid/Unpaid)
- Back / Next / Create Order with disabled nav when data missing
- Success state + placement into Received + staff count + loyalty stamp

> Note: This wizard shape is from the FreshSpin inventory. Current code creates transactions through `components/pages/transactions.tsx:1` and `hooks/use-transactions.ts:1`. Keep the wizard UI but reuse the existing create handler.

### G. Claim Verification

- Ticket lookup and QR validation (`components/pages/claim-verification.tsx:1`)
- QR scanner camera view (`components/qr-scanner.tsx:1`) with `video`/`canvas` refs
- Resolve scanned value (`components/app-shell.tsx:109` -> `resolveScannedValue`)
- Claim -> update transaction status
- Public tracking page (`app/track/[token]/page.tsx:65`) with shareable URL and claim-code note

### H. Members and Rewards (Loyalty)

- Members list + table, search by name/phone (`components/pages/loyalty.tsx:1`)
- Summary card (total members)
- Disabled banner when `loyaltyEnabled` is false
- Add / Edit / Delete member dialogs
- Member detail: avatar, stamps, rewards, preferences, Add Stamps
- Current cycle progress: 10-dot row + history filtered to `currentCycleStamps`
- Reward history table, cycle detail dialog
- API: `/api/loyalty*`, hook `hooks/use-loyalty-members.ts:1`

### I. Reports

5 tabs (`components/pages/reports.tsx:1`):

1. Daily Summary - 4 cards, date picker (Popover + Calendar), transactions table
2. Sales Analytics - Day/Week/Month/Year presets, 4 KPI cards, BarChart, PieCharts, Service Revenue Table
3. Forecast - range select (7d/30d/3m/6m/custom), 4 metric cards, busy-day / peak-hour / monthly trend charts (`buildForecastMetrics`, `getPeakWindows`)
4. Unclaimed Items - Ready filter table
5. Export - checkboxes (Transactions / Sales / Customers), pdf/csv toggle, `handleCsvExport` / `handlePdfExport`

- PDF templates (`components/report-pdf.tsx:1`): `downloadReportPdf`, `downloadForecastReportPdf` (`@react-pdf/renderer`)

### J. Staff and Audit Logs

- Staff table: name, role badge, phone, email, station, orders handled (`components/pages/staff-management.tsx:1`)
- Shift controls (On Shift / On Break / Off Duty) and station reassignment
- Add staff modal
- Audit logs page (`components/pages/audit-logs.tsx:1`): search, category filter, severity filter, event list

### K. Settings

- Pricing: mode toggle (Per Kg / Per Load / Both), price per kg, min weight, tier table (load size, From/To, Open, price, delete), Undo/Redo, Add Custom Tier (`components/pages/settings.tsx:1`)
- Service Types: enabled switch, rows with Show/Price toggles, Add/Edit/Delete, Add Service form
- Add-on Rates: list + add row (name + rate)
- Price Display: Show Price / No Price / Hide Price
- Business Profile: shop name, tagline, address, contact, email, logo, receipt footer, pickup instructions, dirty check
- Loyalty settings, Backup settings, Data Import entry
- Save: `persistPricingConfig` / `persistAddOns` / `persistServiceTypes` + `PUT /api/settings/pricing`, offline queue `lib/offline-settings-sync.ts:1`

### L. Data Import

- CSV upload, parsing, error state, header detection (`components/pages/data-import.tsx:1`)
- Column mapping (Ticket, Customer, Service, Amount, Ignore)
- Preview table + Confirm Import + imported count

### M. Offline and Sync

- Offline fallback page (`app/offline/page.tsx:8`)
- Offline banner + feature list (`components/offline-access-notice.tsx:42`)
- Network status (`lib/network-status.ts:1`)
- Settings queue (`lib/offline-settings-sync.ts:1`, `components/app-shell.tsx:287`)
- Transactions sync (`hooks/use-transactions.ts:1`, `components/app-shell.tsx:99`)

### N. Shared UI Building Blocks

- Buttons, badges, cards, inputs, textareas, labels, selects, tabs, tables, dialogs, sheets, drawers, popovers, tooltips, dropdowns, avatars, progress, skeletons, empty states (`components/ui/*:1`)
- Receipt modal (`components/print-receipt-modal.tsx:1`) with `@media print`
- QR scanner, peak-hours chart, report PDF, status sheet, transaction modals

---

## 2. Workflows (Step by Step)

### W1. Sign In (Admin)

1. Open `app/page.tsx:54` -> role-select
2. Choose Admin -> `components/pages/login.tsx:1` -> Supabase auth
3. On success -> `components/app-shell.tsx:88` loads with `adminProfile`

### W2. Sign In (Staff)

1. Role-select -> Staff -> `components/pages/staff-login.tsx:1`
2. `POST /api/staff/login` (`app/page.tsx:137`)
3. Load staff profile, show limited nav (`components/sidebar.tsx:89`, `components/app-shell.tsx:248`)

### W3. Create a Transaction

1. Transactions page -> create form -> `hooks/use-transactions.ts:1` `createTransaction`
2. Or New Order wizard (inventory shape) -> same `createTransaction` handler
3. New record appears in Processing (Received) and Transactions, dashboard counts update

### W4. Move an Order Through Processing

1. `components/pages/processing.tsx:1` -> card shows current stage
2. Forward / Back updates `status` via `onUpdateTransaction` (`components/app-shell.tsx:197`)
3. Move is blocked at first and last stage; voided/claimed are skipped (`components/app-shell.tsx:121`)

### W5. Edit a Transaction

1. From Transactions or Processing -> `handleEditTransaction` (`components/app-shell.tsx:172`) -> sets `editTxn`, opens edit modal, switches to Transactions
2. `components/transaction-edit-modal.tsx:1` guards unsaved changes (`onOpenChange`, `onPointerDownOutside`)
3. Save -> `updateTransaction` -> toast + refetch

### W6. View Detail / Print Receipt / Track

1. View detail -> `handleTransactionDetail` (`components/app-shell.tsx:166`) -> `TransactionDetailModal`
2. Print -> `components/print-receipt-modal.tsx:1` -> browser print
3. Track -> `app/track/[token]/page.tsx:65` -> public page, no login

### W7. Verify a Claim (Staff at Counter)

1. `components/pages/claim-verification.tsx:1` -> enter ticket or scan QR (`components/qr-scanner.tsx:1`)
2. `resolveScannedValue` finds transaction -> mark as Claimed
3. Customer can also use claim code from tracking page

### W8. Manage Loyalty

1. `components/pages/loyalty.tsx:1` -> search -> select member -> `GET /api/loyalty/[id]`
2. Add Stamps -> `POST /api/loyalty/[id]/stamps` (stamps + reason) -> `refetch` + toast
3. View reward cycle -> dialog with visits + summary
4. Add/Edit/Delete member -> dialogs -> refetch

### W9. View Reports and Export

1. `components/pages/reports.tsx:1` -> pick tab + date/preset
2. Daily/Sales/Forecast charts render from `transactions`
3. Export tab -> choose data + format -> `downloadReportPdf` / `downloadForecastReportPdf` or CSV

### W10. Manage Staff and Check Audit Logs

1. `components/pages/staff-management.tsx:1` -> add staff, change shift/station
2. `components/pages/audit-logs.tsx:1` -> search / filter by category/severity

### W11. Change Settings

1. `components/pages/settings.tsx:1` -> edit pricing / services / add-ons / business profile
2. Save -> `persist*` + `PUT /api/settings/pricing` -> if offline, `enqueueSettingsMutation`
3. On reconnect -> `processSettingsQueue` (`components/app-shell.tsx:287`) replays queue
4. Show saved / error / queued states

### W12. Import Data

1. `components/pages/data-import.tsx:1` -> upload CSV -> parse -> map columns
2. Preview -> Confirm Import -> imported count -> View Transactions

### W13. Work Offline

1. Lose connection -> `components/offline-access-notice.tsx:1` lists available vs unavailable features
2. Available: Dashboard, Processing, Transactions, Claim, Profile, Settings (view/queue)
3. Blocked: Reports, Staff, Audit Logs, Data Import (`components/app-shell.tsx:255`)
4. Changes queue; Retry sync (`components/app-shell.tsx:106`) or go to `app/offline/page.tsx:8`

### W14. Change Password / Update Profile

1. Profile -> update avatar/name -> `onProfileUpdate` (`components/app-shell.tsx:241`)
2. Change Password -> `components/pages/change-password.tsx:1` -> current/new/confirm checks -> success state

---

## 3. Quick Checklist for Redesign

Before marking a screen done, confirm:

- [ ] Every button, filter, column, and dialog from this file still exists
- [ ] All handlers (`onClick`, `onChange`, `onSubmit`, `onSave`) are still wired
- [ ] Form bindings (`register`, `value`, `error`) are still wired
- [ ] Modal close paths (X, Cancel, outside click, ESC) + unsaved guard still work
- [ ] Dark mode (`dark:` classes) still readable
- [ ] Mobile layout has no horizontal scroll, tables have a card fallback
- [ ] Offline / queued / synced states are still shown
