# Profile, Friend Loading, and UID Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make confirmed friends available to games, expose paired/profile state, add a Profile hub tab, and support login by email or numeric display UID.

**Architecture:** Keep Supabase as the source of profile, friend, partner, and auth data. Add pure routing/view-model helpers for testable behavior, then connect them to the existing AuthModal, Hub, Games, and new Profile panel. Avatar customization uses a profile URL field; badges remain local view-model data until a future badge table exists.

**Tech Stack:** React 19, TypeScript, Supabase Auth/Postgres, Vite, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-28-profile-friend-login-design.md`

## Global Constraints

- Games friend mode loads accepted friend relationships; a partner relationship is not required.
- Hub navigation order is Games, Friends, Profile, Settings.
- Email input containing `@` uses email/password login; input without `@` resolves numeric `profiles.display_uid` to email before password login.
- Existing email login, friend requests, chat, partner requests, and settings remain compatible.
- Finish with `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

## Review Focus

- UID login with whitespace, nonnumeric text, or an unknown numeric UID shows an actionable error and never attempts a password login: Task 1.
- A user with accepted friends but no partner can still select them in Games: Task 2.
- Missing optional avatar columns do not blank the Profile or Games surface: Task 2.
- Partner display remains unpaired until both profile rows are updated: Task 3.
- Profile edits preserve the existing display name and UID when only avatar changes: Task 3.

### Task 1: Authentication identifier routing

**Files:**
- Modify: `src/lib/friendSearch.ts`
- Modify: `src/components/AuthModal.tsx`
- Test: `tests/friendSearch.test.ts`

**Interfaces:**
- Produces `authIdentifierTarget(input): { field: 'email' | 'display_uid'; value: string | number } | null`.
- AuthModal resolves `display_uid` through `profiles.select('email').eq('display_uid', uid).maybeSingle()` before `signInWithPassword`.

- [ ] Write failing tests for email routing, numeric UID routing, invalid non-email input, and unknown UID handling.
- [ ] Run `npm test -- tests/friendSearch.test.ts` and observe expected failures.
- [ ] Implement the routing helper and UID lookup branch while preserving registration and email login.
- [ ] Run the focused test and full type-check.
- [ ] Commit `feat: support email and uid login identifiers`.

### Task 2: Accepted friend loading and paired view models

**Files:**
- Modify: `src/lib/gamePresence.ts`
- Modify: `src/components/Games.tsx`
- Modify: `src/components/PartnerStatus.tsx`
- Test: `tests/profileSocial.test.ts`

**Interfaces:**
- Produces `acceptedFriendIds(rows, userId): string[]` and `pairedLabel(partnerId, partnerName): string`.
- Games uses accepted friend IDs and optional profile fields to render online/offline friends even when no partner exists.

- [ ] Write failing tests for accepted friend extraction, unpaired state, paired label, and optional profile field tolerance.
- [ ] Run the focused test and observe expected failures.
- [ ] Implement the pure helpers and update Games/PartnerStatus data loading with actionable fallback behavior.
- [ ] Run focused tests, type-check, and lint.
- [ ] Commit `feat: load confirmed friends and paired state`.

### Task 3: Profile hub panel and avatar customization

**Files:**
- Create: `src/components/Profile.tsx`
- Create: `src/components/Profile.css`
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/components/Hub.tsx`
- Create: `supabase/migrations/202609280002_add_profile_avatar.sql`
- Test: `tests/profileSocial.test.ts`

**Interfaces:**
- Profile reads/writes `display_name`, `avatar_url`, `display_uid`, `partner_id`, and `partner_name` for the authenticated user.
- Profile renders partner details, badges, and a future-features placeholder without changing Settings logout/audio behavior.

- [ ] Extend the failing profile view-model tests for avatar, UID, partner, badge, and future-feature data.
- [ ] Run the focused test and observe expected failures.
- [ ] Add the avatar migration and implement Profile plus the new nav tab in the required order.
- [ ] Run focused tests, full tests, type-check, lint, and build.
- [ ] Commit `feat: add profile hub and avatar customization`.

### Task 4: End-to-end verification

- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- [ ] Inspect the final diff for unchanged friend/chat/partner behavior and document any deployment prerequisite.
- [ ] Commit any verification fixes separately if required.
