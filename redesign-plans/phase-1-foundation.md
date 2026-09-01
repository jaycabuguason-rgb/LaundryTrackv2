# Redesign Plan — Phase 1: Foundation (Colors + App Shell)

## Summary
Apply the new warm purple/cream color theme to the design tokens and app shell components. This is purely a color/style change — no logic, layout, or feature changes.

## Reference Codebase
The confirmed color values come from: `E:\tool call\Copy\src\app\globals.css`

---

## Confirmed Color Tokens (from reference codebase — do not invent values)

### Light Mode
```css
--background: hsl(36 33% 96%);           /* warm cream */
--foreground: hsl(244 48% 12%);          /* very dark navy */
--card: hsl(0 0% 100%);                  /* clean white */
--card-foreground: hsl(244 48% 12%);
--popover: hsl(38 45% 99%);
--popover-foreground: hsl(244 48% 12%);
--primary: hsl(257 58% 49%);             /* purple accent */
--primary-foreground: hsl(0 0% 100%);
--secondary: hsl(35 28% 92%);            /* warm off-white */
--secondary-foreground: hsl(244 35% 18%);
--muted: hsl(35 28% 93%);
--muted-foreground: hsl(251 18% 49%);
--accent: hsl(44 83% 61%);               /* golden amber */
--accent-foreground: hsl(30 50% 15%);
--destructive: hsl(0 84% 60%);
--destructive-foreground: hsl(0 0% 98%);
--border: hsl(33 18% 82%);               /* warm beige */
--input: hsl(33 18% 82%);
--ring: hsl(257 58% 49%);
--radius: 0.875rem;

--sidebar: hsl(258 52% 14%);             /* deep dark purple-black */
--sidebar-foreground: hsl(260 35% 94%);  /* light lavender-white */
--sidebar-primary: hsl(257 70% 65%);     /* bright purple for active left border */
--sidebar-primary-foreground: hsl(0 0% 100%);
--sidebar-accent: hsl(262 32% 23%);      /* darker purple for active item bg */
--sidebar-accent-foreground: hsl(260 35% 94%);
--sidebar-border: hsl(261 35% 25%);
--sidebar-ring: hsl(257 70% 65%);

--chart-1: hsl(260 58% 62%);
--chart-2: hsl(214 62% 59%);
--chart-3: hsl(39 79% 54%);
--chart-4: hsl(142 42% 46%);
--chart-5: hsl(266 17% 53%);

--status-received: hsl(257 58% 49%);
--status-washing: hsl(214 62% 59%);
--status-ready: hsl(142 42% 46%);
```

### Dark Mode
```css
--background: hsl(255 25% 7%);
--foreground: hsl(255 15% 90%);
--card: hsl(255 20% 11%);
--card-foreground: hsl(255 15% 90%);
--popover: hsl(255 20% 12%);
--popover-foreground: hsl(255 15% 90%);
--primary: hsl(257 70% 65%);
--primary-foreground: hsl(0 0% 100%);
--secondary: hsl(255 15% 18%);
--secondary-foreground: hsl(255 15% 90%);
--muted: hsl(255 15% 16%);
--muted-foreground: hsl(255 10% 55%);
--accent: hsl(44 83% 60%);
--accent-foreground: hsl(255 25% 7%);
--destructive: hsl(0 75% 55%);
--destructive-foreground: hsl(0 0% 98%);
--border: hsl(255 15% 18%);
--input: hsl(255 15% 18%);
--ring: hsl(257 70% 65%);

--sidebar: hsl(255 25% 5%);
--sidebar-foreground: hsl(255 15% 90%);
--sidebar-primary: hsl(257 70% 65%);
--sidebar-primary-foreground: hsl(0 0% 100%);
--sidebar-accent: hsl(255 20% 14%);
--sidebar-accent-foreground: hsl(255 15% 90%);
--sidebar-border: hsl(255 15% 20%);
--sidebar-ring: hsl(257 70% 65%);

--chart-1: hsl(257 70% 65%);
--chart-2: hsl(214 62% 59%);
--chart-3: hsl(44 80% 50%);
--chart-4: hsl(142 42% 46%);
--chart-5: hsl(266 20% 58%);

--status-received: hsl(257 70% 65%);
--status-washing: hsl(214 62% 59%);
--status-ready: hsl(142 42% 46%);
```

---

## Files to Change

### 1. `app/globals.css`
- Replace ALL current CSS variable values in `:root` and `.dark` with the confirmed values above
- Keep all existing variable names exactly as they are — only values change
- Keep `@import`, `@custom-variant dark`, and `@layer base` blocks intact

### 2. `components/ui/button.tsx`
- No structural changes — the `primary` variant will automatically pick up the new `--primary` color from globals.css
- Double-check that `variant="default"` uses `bg-primary text-primary-foreground`

### 3. `components/ui/card.tsx`
- No structural changes — card uses `bg-card` and `border-border`, which will automatically update from globals.css

### 4. `components/ui/badge.tsx`
- No structural changes — verify default/secondary variants use theme tokens

### 5. `components/ui/input.tsx`
- No structural changes — verify input uses `bg-input` or `border-input` theme tokens

### 6. `components/ui/table.tsx`
- No structural changes — verify table header uses `bg-muted` or similar theme tokens

### 7. `components/app-shell.tsx`
- No structural changes — verify wrapper uses `bg-background text-foreground`

### 8. `components/sidebar.tsx`
- No structural changes — sidebar already uses `bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`, `border-sidebar-primary` etc.
- After globals.css update, sidebar will automatically look like the reference

### 9. `components/topnav.tsx`
- No structural changes — verify it uses theme tokens (not hardcoded colors)

### 10. `components/mobile-bottom-nav.tsx`
- No structural changes — verify it uses theme tokens (not hardcoded colors)

---

## Rules for the Executing Agent

1. **ONLY change color values** — do not rename variables, remove components, or change JSX structure
2. **Run `tsc --noEmit`** after changes — must pass with zero errors
3. **Check dark mode** — toggle dark class and verify sidebar stays dark, background goes warm-dark
4. **Check mobile** — mobile nav and mobile sidebar drawer must still work
5. **Do NOT touch** any `useState`, `useEffect`, event handlers, Supabase calls, or form bindings
6. Commit with message: `style: redesign phase 1`

---

## Verification Checklist
- [ ] `tsc --noEmit` passes
- [ ] Light mode: cream background, white cards, dark purple sidebar
- [ ] Dark mode: dark purple-black background, slightly lighter cards, dark sidebar
- [ ] Sidebar active item: purple highlighted panel + bright purple left border
- [ ] All nav links still navigate correctly
- [ ] Mobile hamburger menu still opens/closes
- [ ] No missing buttons, links, or UI elements
