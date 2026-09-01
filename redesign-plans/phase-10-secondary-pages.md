# Redesign Plan - Phase 10: Secondary Pages (Auth, Tracker, Profile, Offline)

## Summary
Re-skin the authentication screens (Login, Register, Forgot Password, Staff Login), Customer Public Tracker, User Profile, Data Import, and Offline Fallback screens with the new warm purple/cream design theme.

---

## Scope & Files

### 1. Authentication Screens
- `components/pages/login.tsx`
- `components/pages/register.tsx`
- `components/pages/forgot-password.tsx`
- `components/pages/change-password.tsx`
- `components/pages/staff-login.tsx`
*Styling:* Centered warm card with purple branding, warm inputs, and purple primary submit buttons.

### 2. Public Customer Tracker
- `app/track/[token]/page.tsx`
*Styling:* Clean customer-facing tracking card showing live status steps (Received -> Washed -> Ready -> Claimed), order summary, and estimated completion time with theme colors.

### 3. User Profile & Data Import
- `components/pages/profile.tsx`
- `components/pages/data-import.tsx`
*Styling:* Warm cards, formatted file upload dropzones, and theme buttons.

### 4. Offline Fallback
- `app/offline/page.tsx`
*Styling:* Clean offline indicator with retry action button.

---

## What Must NOT Change
- Supabase auth flows (sign in, sign up, password recovery, session handling)
- Public tracking token decryption & real-time query logic
- CSV/JSON data parsing and validation in data-import
- Service Worker offline cache interception

---

## Verification Checklist
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Login / Register forms submit properly and show correct theme styling
- [ ] Public customer tracker page displays order progress clearly
- [ ] Profile and Data Import pages render properly
- [ ] Light & dark mode verified
