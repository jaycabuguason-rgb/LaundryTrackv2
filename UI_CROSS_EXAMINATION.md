# FreshSpin UI Cross-Examination

This document compares the current FreshSpin UI inventory with the official redesign guide in [`UI_REDESIGN_GUIDE.md`](./UI_REDESIGN_GUIDE.md) and the implementation currently present in this repository.

## How to Read This Document

- The **official redesign guide** is primarily a safety and migration playbook. It explains which business logic, handlers, bindings, widgets, and features must survive a visual redesign.
- The **FreshSpin UI inventory** describes the current or intended screens, workflows, and UI behavior in more detail.
- The **repository implementation** is the final source for what currently exists. Its paths use `app/`, `components/pages/`, `components/`, `hooks/`, and `lib/`, not `src/app/` or `src/components/`.

The two documents are therefore not two complete visual designs. The redesign guide protects functionality; the FreshSpin inventory describes the product surface to compare against it.

## Summary Comparison

| Area | Official guide and implementation | FreshSpin inventory | Relationship | Recommendation |
|---|---|---|---|---|
| Navigation structure | One app shell switches between internal pages | Separate routes are described under `src/app` | Major structural difference | Keep the repository's working page-switching system unless route conversion is explicitly required |
| Dashboard | Transactions, peak-hours chart, and KPI cards | Orders, stage chart, and loyalty metric | Similar purpose, different content | Combine the strongest metrics without removing the existing peak-hours feature |
| Transaction management | Dedicated Transactions screen | Mostly represented by History and New Order | Different grouping | Keep a dedicated transaction-management workspace |
| New transaction | Created through transaction functionality | Dedicated three-step New Order wizard | FreshSpin adds a clearer workflow | Add the wizard presentation while retaining existing transaction handlers |
| Processing | Multi-stage operational queue | Three-column order board | Same purpose | Confirm the official stage list before redesigning |
| Claims | Dedicated Claim Verification screen | Claims tab plus QR scanning in History | Similar features, different location | Keep claim verification clearly accessible as a primary task |
| Loyalty | Dedicated Loyalty page | Members & Rewards with member details | Strong match | Use the richer FreshSpin member and reward structure |
| Reports | Five report tabs are required | Daily and Forecast views are emphasized | FreshSpin omits several official sections | Preserve all five official report areas |
| Staff and audit | Separate pages | Combined under two tabs | Same capabilities, different grouping | Combining them is reasonable if access permissions remain intact |
| Settings | Several settings subpages | Pricing and Business Profile tabs | FreshSpin omits some settings areas | Preserve backup, loyalty, receipt, and service settings |
| Profile | Dedicated page exists in the implementation | Only listed in the source map | Missing FreshSpin specification | Add a Profile section to the FreshSpin inventory |
| Authentication | Admin login, staff login, role selection, registration, and password screens | General login and registration | FreshSpin omits staff entry | Preserve separate staff authentication |
| Offline and sync | Offline notice, sync detail, fallback page, and queued settings | Offline page and queued settings | Strong match | Show whether data is offline, queued, syncing, or synchronized |
| Mobile navigation | Mobile bottom navigation plus shell controls | Mobile header and drawer | Different pattern | Select the pattern based on frequent staff workflows on phones |

## Detailed Screen Comparison

| Screen | Same or similar | Missing from FreshSpin inventory | Extra in FreshSpin inventory | Recommended direction |
|---|---|---|---|---|
| Application shell | Branding, navigation, and theme control | Notifications, avatar menu, breadcrumbs, bottom navigation, and sync indicator | Mobile drawer and first-link focus behavior | Preserve all working shell behavior; the visual navigation pattern can change |
| Login | Email, password, and sign-in | Admin/staff role selection and separate staff login | Forgot-password and create-account links | Include staff and admin entry paths in the redesigned authentication flow |
| Registration | Name, email, and password | No major feature difference identified | Explicit back-to-login action | Keep the FreshSpin form structure |
| Password recovery | Email and reset action | No major feature difference identified | Explicit success state | Keep the FreshSpin feedback state |
| Dashboard | Metrics and recent transaction information | Peak-hours chart and role-based dashboard differences | Orders-by-stage chart and loyalty-member metric | Preserve peak hours and add the useful stage overview |
| Transactions and history | Search, filtering, status, receipts, and tracking | A dedicated editable transaction table and row actions | Tracking links, history cards, and QR scanner | Do not replace transaction management with read-only history |
| New Order | Transaction creation must remain intact | Existing handler and binding details are not identified in the inventory | Dedicated three-step wizard and loyalty side effects | Use the wizard as the new appearance around existing creation logic |
| Processing | Operational stages and transaction movement | The official guide mentions additional processing stages | Received stage and simplified three-stage board | Decide the real stages from implementation and business rules |
| Claim Verification | QR and ticket lookup | Dedicated claim-validation workflow | Claims list, claim amounts, reasons, and resolution notes | Treat verification and claim records as related but separate workflows |
| Members & Rewards | Search, members, stamps, rewards, and dialogs | Disabled-loyalty warning and member preferences | Cards/table switch and richer progress display | Use the FreshSpin detail layout while preserving API and refresh behavior |
| Reports | Daily report, forecast, dates, and PDF export | Sales Analytics, Unclaimed Items, Export tab, CSV export, charts, and service revenue table | Some forecast labels and controls are described in more detail | Preserve the official five-tab report scope |
| Staff | Staff list, roles, stations, and shift states | Permission behavior and staff-specific access rules | Shift controls and station reassignment are more explicit | Keep the FreshSpin controls while enforcing existing role restrictions |
| Audit Logs | Search, filters, categories, and events | Separate protected audit page behavior | Combined Staff/Audit tabs | Tabs are acceptable if permissions and deep linking remain clear |
| Settings | Pricing, services, add-ons, and business details | Backup, loyalty configuration, receipt footer, pickup instructions, and reset confirmation | Undo/redo and tier editing are more explicitly documented | Expand the redesign inventory to cover every official settings subsection |
| Profile | A dedicated page exists | Avatar upload and account details specification | Nothing substantial | Add Profile as a fully documented screen |
| Data Import | CSV upload, mapping, preview, and confirmation | No major difference identified | Detailed column choices and success count | Use the FreshSpin description as the target behavior |
| Public Tracking | Status, customer/order information, and no-login access | Claim code and claim-verification relationship | Shareable URL and explicit invalid-token state | Combine both sets of customer-facing information |
| Offline | Offline explanation and retry | Detailed sync status and feature availability | Explicit view-while-offline explanation | Show exact availability and synchronization status |
| Transaction Edit | Some functionality appears through transaction actions | Universal edit modal and unsaved-changes protection | Not explicitly documented | Add this to the FreshSpin inventory before redesign work |
| Transaction Detail | Transaction cards and receipt preview | Dedicated read-only detail modal | Not explicitly documented | Keep a reusable transaction detail view |
| Mobile Status Update | Forward/backward movement actions | Dedicated status-update sheet | Inline order-card controls | Prefer the sheet on small screens and inline controls on desktop |

## Workflow Comparison

| Workflow | Official guide and implementation | FreshSpin inventory | Main difference | Recommendation |
|---|---|---|---|---|
| Create an order | Existing transaction creation flow with preserved handlers, bindings, and side effects | Customer information, service details, summary, payment choice, and live price | FreshSpin describes the steps more clearly | Use the three-step wizard visually, but preserve creation logic exactly |
| Move an order through processing | The guide describes Washing, Drying, Folding, and Ready | The inventory describes Received, Washing, and Ready | Stage definitions conflict | Confirm the real status enum and business workflow before changing labels or movement logic |
| Verify a claim | Dedicated claim-verification page with ticket lookup and QR validation | QR scanner and claims records are grouped under History | Different placement | Keep a direct Claim Verification entry point even if claim records remain grouped |
| Manage loyalty | Loyalty page, API-backed member data, refresh, toasts, and guarded dialogs | Members, rewards, stamps, cycles, visit history, and reward history | FreshSpin provides more visible detail | Use the richer detail view without replacing API behavior |
| Generate reports | Five report tabs, PDF exports, forecast logic, and export controls | Daily and Forecast reports are emphasized | Official scope is broader | Preserve Daily Summary, Sales Analytics, Forecast, Unclaimed Items, and Export |
| Configure settings | Pricing, service types, add-ons, price display, business profile, and offline queue | Pricing and business profile are emphasized | FreshSpin omits some settings areas | Keep every persisted setting and make offline queue status visible |
| Work offline | Offline banner, feature availability, retry, and queued settings mutations | Offline page and post-reconnection sync | Similar intent, different detail | Show available, unavailable, queued, and synchronized states explicitly |

## Important Conflicts

| Conflict | Official guide says | FreshSpin inventory says | What should happen |
|---|---|---|---|
| File locations | `components/pages/*` and `app/*` | `src/app/*` and `src/components/*` | Follow the actual repository paths |
| Processing stages | Washing, Drying, Folding, and Ready | Received, Washing, and Ready | Verify the status model before redesigning the board |
| Reports | Five tabs | Daily and Forecast are the main named views | Keep all official report sections |
| Claims | Separate Claim Verification page | Claims are grouped with History and Reports | Preserve fast claim verification even if records are grouped elsewhere |
| Mobile navigation | Bottom navigation is listed | Header plus drawer is listed | Select based on staff task frequency, not appearance alone |
| Staff access | Explicit role restrictions exist | Role restrictions are not documented | Preserve the existing restrictions |
| Settings | Multiple settings categories | Mostly Pricing and Business Profile | Add omitted settings categories |
| New Order | No separate page is emphasized in the official guide | Dedicated three-step page | Introduce the wizard without changing transaction logic |

## Repository Path Corrections

The FreshSpin inventory refers to `src/app` and `src/components`, but this repository currently uses these paths:

| Area | Actual repository path |
|---|---|
| Main app entry | [`app/page.tsx`](./app/page.tsx) |
| Public tracking | [`app/track/[token]/page.tsx`](./app/track/%5Btoken%5D/page.tsx) |
| Offline fallback | [`app/offline/page.tsx`](./app/offline/page.tsx) |
| App shell | [`components/app-shell.tsx`](./components/app-shell.tsx) |
| Page components | [`components/pages/`](./components/pages/) |
| Navigation | [`components/sidebar.tsx`](./components/sidebar.tsx), [`components/topnav.tsx`](./components/topnav.tsx), and [`components/mobile-bottom-nav.tsx`](./components/mobile-bottom-nav.tsx) |
| Specialized widgets | [`components/qr-scanner.tsx`](./components/qr-scanner.tsx), [`components/peak-hours-chart.tsx`](./components/peak-hours-chart.tsx), and [`components/report-pdf.tsx`](./components/report-pdf.tsx) |
| Shared primitives | [`components/ui/`](./components/ui/) |

The official guide's older examples such as `components/app-shell.tsx` are useful conceptually and match this repository, but any redesign work should use the actual paths above.

## Recommended Source of Truth

Use the sources in this order when they disagree:

1. **Current implementation:** determines what the application actually does today.
2. **Official redesign guide:** determines what must not break while changing the UI.
3. **FreshSpin inventory:** determines the proposed screen grouping, visible features, and comparison checklist.
4. **Final approved visual design:** determines colors, typography, spacing, layout, and component appearance once it is available.

## Recommended Changes to the FreshSpin Inventory

Before implementation, add these items to the FreshSpin inventory:

1. Dedicated transaction management and transaction editing.
2. Separate admin and staff authentication.
3. Profile and avatar management.
4. All five reporting sections.
5. Claim verification as a direct workflow, not only claim records.
6. Backup, loyalty, receipt, and other settings areas.
7. Notifications and synchronization status.
8. Transaction detail and status-update overlays.
9. Role-based access restrictions.
10. The confirmed processing-stage list.

## Cross-Examination Checklist

Use this checklist for every screen, component, and workflow during the redesign.

### Purpose and Hierarchy

- What is the primary job of this screen?
- Can a new user identify the primary action within five seconds?
- Is the visual hierarchy aligned with operational importance?
- Are related actions grouped together?
- Are frequent actions easy to reach for both cursor and thumb?

### Data and System State

- Is the current state visible without requiring inference?
- Are all displayed numbers connected to stored data?
- Which elements are real, mocked, hardcoded, demo-only, or unknown?
- Does the UI distinguish local, synced, queued, and unavailable data?
- What happens after a refresh?
- What happens when data changes in another view?

### Empty, Loading, and Error States

- What happens when there is no data?
- What happens when filtering returns no results?
- Are loading states shown during asynchronous operations?
- What happens when a request fails?
- Does the user receive a clear recovery action?
- Can the user retry without losing entered data?
- Are destructive actions confirmed?

### Forms and Validation

- Are required fields clearly identified?
- Are labels associated with their inputs?
- Is validation shown next to the field that needs correction?
- Are invalid values prevented before submission?
- Are numeric ranges and formats enforced?
- Does the summary accurately reflect the entered values?
- Is unsaved state distinguishable from saved state?

### Navigation and Interaction

- Can every workflow be completed with keyboard input?
- Are focus states visible?
- Does focus move correctly when a dialog opens and closes?
- Can the user close overlays with Escape or an explicit close control?
- Does browser back navigation preserve or discard state intentionally?
- Does active navigation accurately reflect the current page?

### Accessibility

- Does every interactive control have an accessible name?
- Do icon-only controls have useful labels or tooltips?
- Are touch targets large enough on mobile?
- Is color alone insufficient to communicate status?
- Is text contrast adequate in light and dark modes?
- Does reduced-motion preference suppress nonessential animation?
- Are tables understandable to screen-reader users?

### Mobile and Responsive Behavior

- Is there horizontal overflow at narrow widths?
- Do tables have an intentional mobile strategy?
- Does fixed navigation obscure content?
- Are dialogs usable on small screens?
- Are sticky actions reachable and non-obstructive?
- Does text wrap without clipping or overlap?
- Are controls large enough for touch interaction?

### Domain and Trust

- Does terminology match the actual laundry workflow?
- Are customer-facing and staff-facing concepts clearly separated?
- Are prices, weights, statuses, and dates consistent across screens?
- Does the UI reveal when a value is only a demo or estimate?
- Are customer data and account credentials handled appropriately?

## Known Risks to Recheck

- The graph artifact is available under `graphify-out/`, but the repository's documented graph reference is [`docs/PROJECT_GRAPH.md`](./docs/PROJECT_GRAPH.md), which may be stale or absent.
- The QR scanner includes a demo-only simulated scan path in [`components/qr-scanner.tsx`](./components/qr-scanner.tsx).
- Forecast report values are partly hardcoded in the reports implementation.
- Member visit history and reward details include explicitly mocked data.
- Authentication uses a client-side auth store; verify that credentials are not persisted insecurely before production use.
- Several screens use custom controls and local color classes instead of consistently reusing shared UI primitives and semantic tokens.
- The visual system uses a strong purple/beige palette with many local color values; verify contrast, consistency, and intended brand direction.
- The route inventory should be regenerated whenever routes or major screens are added or removed.

## Bottom Line

Use the FreshSpin inventory as the **proposed screen and workflow structure**. Use `UI_REDESIGN_GUIDE.md` and the current code as the **feature-preservation checklist**.

The redesign should change the presentation layer only: layout, colors, typography, spacing, icons, and component styling. It should not remove or silently change business logic, API calls, state, form bindings, modal close behavior, chart mechanics, QR scanner references, print styles, role restrictions, or offline synchronization.
