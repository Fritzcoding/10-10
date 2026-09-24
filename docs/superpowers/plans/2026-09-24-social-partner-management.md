# Social & Partner Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Stage 5 friend search, friend/partner request handling, settings, and Hub integration for the Supabase-backed couple app.

**Architecture:** Keep data operations inside focused React components that use the existing Supabase client. `Hub` selects the active panel, `App` owns authentication view state, and `audio.ts` remains the single owner of shared background-music controls.

**Tech Stack:** React 19, TypeScript, Vite, Supabase JS, Lucide React, CSS.

**Spec:** `docs/superpowers/specs/2026-09-24-social-partner-management-design.md`

## Global Constraints

- Preserve the existing component and CSS style; make only requested changes.
- Use the existing `profiles` table conventions: `id`, `email`, `display_name`, `partner_id`, and `partner_name`.
- Use `friend_requests` with `requester_id`, `recipient_id`, `status`, and `created_at`.
- Surface Supabase configuration, schema, and policy errors in the UI.
- Run `npx tsc --noEmit` and `npm run build` before marking stages complete.
- Update `DOCS.md` and `MEMORY.md` only after verification succeeds.

## Review Focus

- Missing Supabase configuration must show an actionable message instead of throwing.
- Searching for the current user's own email or an empty email must not create a request.
- Duplicate pending requests must be rejected without duplicating rows.
- Accepting a request must refresh the confirmed-friend list and partner display state.
- Logout must reset `App` to the auth view after `signOut()` succeeds.

---

### Task 1: Audio volume API

**Files:**
- Modify: `src/lib/audio.ts`

**Interfaces:**
- Produces `getBackgroundMusicVolume(): number` and `setBackgroundMusicVolume(volume: number): void` for `Settings.tsx`.

- [ ] **Step 1: Add the volume API test or verification seam**

Because this repo has no test runner, define the two exported functions against the existing lazy audio element and use TypeScript/build verification as the executable check.

- [ ] **Step 2: Implement minimal volume controls**

Clamp incoming values to `[0, 1]`, apply the value to the lazily-created HTML audio element, and apply the same normalized value to the fallback oscillator gain without changing playback behavior.

- [ ] **Step 3: Run verification**

Run: `npx tsc --noEmit`

Expected: PASS.

### Task 2: Friends screen

**Files:**
- Create: `src/components/Friends.tsx`
- Create: `src/components/Friends.css`

**Interfaces:**
- Consumes: `supabase` and the existing `profiles`/`friend_requests` data contracts.
- Produces: a self-contained Friends panel rendered by `Hub`.

- [ ] **Step 1: Define the component state and data types**

Track current user, confirmed friends, search email/result, incoming pending requests, loading state, and one inline error/status message. Use explicit local types for profile and request rows.

- [ ] **Step 2: Implement initial loading**

Read the current user, load the current profile's confirmed friend relationship, and load incoming pending requests. Keep Supabase-null handling visible in the UI.

- [ ] **Step 3: Implement email search and request creation**

Trim and lowercase the email, reject empty/self searches, query `profiles`, check for duplicate pending requests, and insert one pending request for a valid result.

- [ ] **Step 4: Implement accept and partner actions**

Accept incoming requests by updating `friend_requests.status`, refresh friends, and add “Send Partner Request” beside confirmed friends. On partner acceptance, update both profile rows with reciprocal partner IDs/names and refresh the current list.

- [ ] **Step 5: Add focused mobile-first styling**

Style the search form, friend rows, request cards, status/error text, and action buttons using the existing glassmorphism palette and avoid changing global layout rules.

- [ ] **Step 6: Verify the component compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

### Task 3: Settings screen

**Files:**
- Create: `src/components/Settings.tsx`
- Create: `src/components/Settings.css`

**Interfaces:**
- Consumes: `getBackgroundMusicVolume`, `setBackgroundMusicVolume`, and `supabase`.
- Produces: a settings panel accepting `onLogout: () => void`.

- [ ] **Step 1: Define display-name and volume state**

Initialize the volume from `getBackgroundMusicVolume()` and the display name from `supabase.auth.getUser()` metadata.

- [ ] **Step 2: Implement display-name save**

Trim the name, reject an empty value, call `supabase.auth.updateUser({ data: { display_name: trimmedName } })`, and show success/error feedback.

- [ ] **Step 3: Implement volume slider**

Render an accessible range input from 0 to 1 with a 0.01 step and call `setBackgroundMusicVolume` on change.

- [ ] **Step 4: Implement logout**

Call `supabase.auth.signOut()`, show any error, and call `onLogout()` only after a successful sign-out.

- [ ] **Step 5: Add focused styling and verify**

Style the settings form and destructive logout action, then run `npx tsc --noEmit`.

Expected: PASS.

### Task 4: Hub and App integration

**Files:**
- Modify: `src/components/Hub.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `Hub` consumes `onLogout: () => void` and renders `Friends` for `activeTab === 'friends'` and `Settings` for `activeTab === 'settings'`.
- `App` passes `() => setView('auth')` to `Hub`.

- [ ] **Step 1: Add the logout callback to App and Hub**

Keep existing auth-state subscription behavior and pass the callback through without changing the birthday/auth flow.

- [ ] **Step 2: Replace placeholder panels**

Preserve the games panel copy while conditionally rendering the Friends and Settings components in the shared hub panel area.

- [ ] **Step 3: Verify tab integration**

Run: `npx tsc --noEmit`

Expected: PASS.

### Task 5: Documentation and final verification

**Files:**
- Modify: `DOCS.md`
- Modify: `MEMORY.md`

- [ ] **Step 1: Add Stage 5 tracking entries**

Add checked entries for 5.1 Friend Search & Requests, 5.2 Partner Requests, and 5.3 Settings. Add exact commit messages:

```text
Stage 5.1: Add friend search and requests
Stage 5.2: Add partner request management
Stage 5.3: Add user settings and logout
```

- [ ] **Step 2: Update project memory**

Record the completed Friends, partner-request, settings, audio-volume, and logout behavior plus the verification commands.

- [ ] **Step 3: Run final checks**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: both commands PASS with zero TypeScript errors.

- [ ] **Step 4: Output commit commands**

Provide one dedicated block per micro-stage using the exact messages above:

```bash
git add .
git commit -m "Stage 5.1: Add friend search and requests"

git add .
git commit -m "Stage 5.2: Add partner request management"

git add .
git commit -m "Stage 5.3: Add user settings and logout"
```
