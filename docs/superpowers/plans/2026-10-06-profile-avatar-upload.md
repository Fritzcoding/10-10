# Profile Avatar Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user choose, preview, upload, replace, and display a profile avatar from their phone or computer while keeping the stored image private to the owner and connected friends/partner.

**Architecture:** Store one stable image object per user in a private Supabase Storage bucket. Persist the object path in the existing `profiles.avatar_url` field, create a signed URL for display, and keep existing HTTP(S) avatar values working. Enforce owner writes and relationship-scoped reads in Storage policies.

**Tech Stack:** React, TypeScript, Supabase Storage/Postgres RLS, pgTAP, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-06-connected-tiny-games-profile-and-drawing-prompts-design.md`

## Global Constraints

- Bucket: private `profile-avatars`; object path: `<user-uuid>/avatar`.
- Accept JPEG, PNG, and WebP up to 5 MiB (`5 * 1024 * 1024` bytes).
- Only the owner may upload, replace, or delete; only the owner and confirmed friends/partner may read.
- Save object paths in `profiles.avatar_url`; continue rendering existing HTTP(S) values.
- Do not add a dependency or deploy migrations to hosted Supabase.

## Review Focus

- GIF, SVG, unsupported types, and files over 5 MiB are rejected before upload (test in Task 1).
- A failed upload or profile update does not report success or change the saved profile pointer (component flow covered in Task 3).
- A signed-in unrelated user cannot read an avatar object and another user cannot replace/delete it (pgTAP tests in Task 2).
- Replacing the avatar uses the stable path and replaces its content without leaving orphaned profile objects (Storage upsert test in Task 2).
- Existing HTTP(S) avatar URLs still render as URLs instead of being treated as Storage paths (test in Task 1).

---

### Task 1: Avatar path, validation, and display-source rules

**Files:**
- Create: `src/lib/profileAvatar.ts`
- Create: `tests/profileAvatar.test.ts`

**Interfaces:**
- `MAX_AVATAR_BYTES = 5 * 1024 * 1024`.
- `isValidAvatarFile(file: Pick<File, 'type' | 'size'>): boolean` accepts only `image/jpeg`, `image/png`, or `image/webp` within the limit.
- `profileAvatarPath(userId: string): string` returns `${userId}/avatar` for a valid UUID and throws for malformed IDs.
- `isRemoteAvatarUrl(value: string | null | undefined): boolean` identifies legacy HTTP(S) values.

- [ ] **Step 1: Write failing tests** named `accepts the three supported types up to 5 MiB`, `rejects unsupported or oversized images`, `builds a user-owned stable avatar path`, `rejects invalid user ids`, and `keeps legacy HTTP URLs distinguishable`.
- [ ] **Step 2: Run** `node --test tests/profileAvatar.test.ts`; confirm imports/expectations fail.
- [ ] **Step 3: Implement** the pure validation and path helpers without browser or Supabase dependencies.
- [ ] **Step 4: Run** `node --test tests/profileAvatar.test.ts`; confirm all pass.

### Task 2: Private avatar Storage migration and authorization tests

**Files:**
- Create: migration using `npx supabase migration new private_profile_avatars` (use its generated timestamped path under `supabase/migrations/`)
- Create: `supabase/tests/profile_avatars.test.sql`

**Interfaces:**
- Create private bucket `profile-avatars`, 5 MiB file limit, MIME allowlist JPEG/PNG/WebP.
- Policies allow authenticated owner read/insert/update/delete for exactly `<auth.uid()>/avatar`.
- Read policy also permits a confirmed `friend_requests` relationship with status `accepted` or a shared couple membership; it grants no writes to those readers.
- Keep RLS and grants restricted to authenticated users; do not modify other bucket policies.

- [ ] **Step 1: Write pgTAP tests first** for bucket privacy/size/MIME configuration, owner read and upsert, accepted-friend and partner read, unrelated-user read rejection, and non-owner write/delete rejection.
- [ ] **Step 2: Run** `npx supabase test db --local`; confirm new policy assertions fail against the current schema.
- [ ] **Step 3: Create the migration** with `npx supabase migration new private_profile_avatars`; add bucket settings and narrowly scoped `storage.objects` policies.
- [ ] **Step 4: Run** `npx supabase test db --local`; expect all existing and avatar authorization tests to pass.

### Task 3: Profile file picker, upload, preview, and signed display

**Files:**
- Modify: `src/components/Profile.tsx`
- Modify: `src/components/Profile.css`
- Modify: `tests/profileSocial.test.ts` (only if the avatar profile view model changes)
- Modify: `tests/stage2Pwa.test.ts` (only if profile accessibility is asserted there)

**Interfaces:**
- Keep `ProfileRow.avatar_url` as the saved URL-or-object-path field.
- On file selection: validate; upload to `profile-avatars/<user-uuid>/avatar` with `upsert: true` and the actual `contentType`; update `profiles.avatar_url` only after successful upload.
- For an object path, call `storage.from('profile-avatars').createSignedUrl(path, 3600)` and render the returned URL; for legacy HTTP(S), render the value directly.
- Use an accessible `<input type="file" accept="image/jpeg,image/png,image/webp">`, disable it during save/upload, show preview and status/error text, and leave the persisted profile value alone on any failure.

- [ ] **Step 1: Add failing tests** for invalid-file rejection and legacy URL display in the pure helper. Keep upload/profile write ordering in the component implementation and verify its failure paths in the browser in Task 4; this repository has no component test harness.
- [ ] **Step 2: Run** `node --test tests/profileAvatar.test.ts`; confirm the new pure-helper assertions fail.
- [ ] **Step 3: Implement** the file picker and Storage/profile update sequence using `profileAvatar.ts`.
- [ ] **Step 4: Run** `node --test tests/profileAvatar.test.ts`, `npx tsc --noEmit`, and `npm run lint`.

### Task 4: Verify avatar upload in the local app

**Files:**
- Modify: `DOCS.md`
- Modify: `MEMORY.md`

- [ ] **Step 1: Run** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx supabase test db --local`, and `git diff --check`.
- [ ] **Step 2: In an authenticated local browser, upload JPEG, PNG, and WebP samples; verify preview, persisted path, reload persistence, replacement, 5 MiB boundary, and rejection of unsupported/oversized files.
- [ ] **Step 3: Verify** partner/confirmed-friend display and unrelated-user denial using two authenticated local sessions; inspect screenshots, console, and mobile file-picker layout.
- [ ] **Step 4: Update** `DOCS.md` and `MEMORY.md` with exact results only after all checks pass. Keep the migration local.
