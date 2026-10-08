# Stage 17: Scheduled Surprises Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let partners schedule a private surprise that neither partner can read until the database release time.

**Architecture:** Add a couple-scoped surprises table with private payload storage and a database-time read boundary. Authenticated database functions manage unreleased content and expose content only after release; the app lists released surprises and provides a creator's minimal pending status without returning the hidden payload.

**Tech Stack:** Existing React/Vite, TypeScript, Supabase/PostgreSQL, Node tests, local Supabase and pgTAP.

**Spec:** `docs/superpowers/specs/2026-10-06-relationship-features-and-android-widgets.md`, Stage 17.

## Global Constraints

- Couple membership remains the authorization scope.
- Use database time for release checks.
- Never expose unreleased content through queries, widgets, notifications, caches, or Realtime payloads.
- Keep migration local; do not deploy it to hosted Supabase.
- Add no dependency.
- Do not mark Stage 16 complete; user reprioritized Stage 17 while Stage 16 remains an open release gate.

## Review Focus

- Before release, neither creator nor partner can query the payload; pending status contains metadata only.
- At the boundary, released content becomes visible based on database time, independent of client timezone.
- Unrelated accounts cannot enumerate, read, modify, or cancel another couple's surprises.
- Editing/canceling is allowed only before release; retrying schedule operations does not duplicate a surprise.
- Realtime and widget consumers receive no unreleased payload.

---

### Task 1: Private database lifecycle

**Files:**
- Create: `supabase/migrations/<timestamp>_stage_17_scheduled_surprises.sql`
- Create: `supabase/tests/database/stage_17_scheduled_surprises.test.sql`

**Interfaces:**
- Table: couple id, creator id, surprise type (`note`, `question`, `photo`, `challenge`, `activity`), release time, payload, status, created/updated timestamps.
- RPCs: schedule, cancel pending, read released surprises, and read creator pending metadata. All derive caller identity from `auth.uid()` and use database `now()`.

- [x] Write pgTAP checks for paired creator/partner, unrelated account, pre-release query/Storage/RPC, server-time release, duplicate retries, unauthorized mutation, and cancellation (32/32 pass).
- [x] Run the new database tests and confirm failure before implementing the migration.
- [x] Implement least-privilege grants and membership-checked RPCs. The private table is not published to Realtime; clients access released payload only through the server-filtered RPC.
- [x] Full local pgTAP suite passed: 396/396 checks, including scheduled surprises (32 assertions).
- [ ] Repeat clean full local migration replay and complete local schema diff. `supabase db diff --local` stalled while preparing its shadow database and was stopped.
- [x] Run local advisors; five existing RLS init-plan performance warnings were reported for older friend/notification/subscription policies, with no Stage 17-specific finding.

### Task 2: Surprise client and shared-space UI

**Files:**
- Create: `src/lib/scheduledSurprises.ts`
- Create: `src/components/ScheduledSurprises.tsx`
- Modify: `src/components/Us.tsx`
- Modify: `src/components/Us.css`
- Create: `tests/scheduledSurprises.test.ts`

**Interfaces:**
- `validateScheduledSurprise(input, now)` validates type, required payload, and a future release timestamp; server time remains authoritative.
- Component accepts `coupleId` and `userId`; it renders a schedule form, own pending metadata, and couple-visible released content.

- [x] Write and run failing tests for type/payload validation, past/invalid dates, valid future schedule, duplicate-safe request behavior, and released/pending rendering model.
- [x] Implement minimal validation and RPC-only client calls; never select payload from the table directly or subscribe to hidden rows.
- [x] Add the section to “Us”, refresh on app focus and bounded polling, and show clear network errors without clearing saved state.
- [ ] Verify desktop and narrow mobile UI, accessibility, and save screenshots for pending, released, and empty states. Browser screenshots were inspected during the run but are not stored as evidence files; narrow viewport/keyboard remains open.

### Task 3: Acceptance and records

**Files:**
- Modify: `DOCS.md`
- Modify: `MEMORY.md`
- Modify: `docs/superpowers/specs/2026-10-06-relationship-features-and-android-widgets.md`
- Modify: `docs/PROJECT_STATE_AND_RELEASE_PLAN.md`
- Create: `docs/verification/stage-17/` evidence

- [x] Run two authenticated isolated local browser accounts: verify pending payload is absent for both; advance the local database release time and verify the partner sees note and photo content only after release.
- [ ] Verify unrelated-user access and cancellation (covered by pgTAP/UI); additionally exercise offline/retry and inspect browser network payloads for hidden content.
- [x] Run `npm test` (168), `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --check`, and full local pgTAP (396); inspect browser console. Android unit tests and debug APK build also passed.
- [ ] Complete migration replay/schema diff; save durable screenshots; verify mobile/keyboard, offline/retry, payload inspection, and Android WebView picker.
- [x] Update DOCS, MEMORY, spec, and this plan with verified status and open checks. Stage remains unaccepted until outstanding checks pass. Commit message: `Stage 17: Add scheduled surprises`.

## Explicit order decision

The user directed Stage 17 to proceed before Stage 16 acceptance. Stage 16 remains incomplete and a release gate; this plan does not close or waive its acceptance checks.
