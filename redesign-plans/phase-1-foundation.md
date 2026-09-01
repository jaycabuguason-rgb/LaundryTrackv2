# Redesign Plan - Phase 1: Foundation (Colors & App Shell)

## Summary
Apply the confirmed design tokens (warm cream background, deep dark purple sidebar, purple primary buttons, amber accents) from `E:\tool call\Copy\src\app\globals.css` into `app/globals.css`, base UI primitives, and the App Shell.

## Confirmed Theme Tokens (from reference codebase)
- Background: `hsl(36 33% 96%)` (Warm cream)
- Foreground: `hsl(244 48% 12%)` (Dark navy text)
- Card: `hsl(0 0% 100%)` (Clean white)
- Primary: `hsl(257 58% 49%)` (Purple accent)
- Accent: `hsl(44 83% 61%)` (Golden amber)
- Border / Input: `hsl(33 18% 82%)` (Warm beige)
- Sidebar: `hsl(258 52% 14%)` (Deep dark purple)
- Sidebar Foreground: `hsl(260 35% 94%)`
- Sidebar Accent: `hsl(262 32% 23%)`
- Sidebar Primary: `hsl(257 70% 65%)` (Bright purple left indicator)

## Scope & Files
- `app/globals.css` (Update `:root` and `.dark` variables)
- `components/app-shell.tsx` (App layout container)
- `components/sidebar.tsx` (Sidebar styling & active indicator)
- `components/topnav.tsx` (Top navigation bar)
- `components/mobile-bottom-nav.tsx` (Mobile bottom bar)
- `components/ui/*` (Button, Card, Badge, Input, Table primitives)

## Verification Checklist
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] Light mode shows warm cream background and dark purple sidebar
- [ ] Dark mode maintains high contrast
- [ ] Sidebar navigation works across desktop and mobile
