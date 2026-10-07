# Stage 13: Mood Check-ins and Rituals Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement each task in order. Each task uses RED → GREEN and ends with its verification.

**Goal:** Add optional, non-clinical mood notes and weekly couple rituals with explicit sharing, participation, and in-app reminder controls.

**Architecture:** Store mood entries and rituals in couple-scoped RLS tables. Mood entries default private and are visible to the partner only when shared; authors can delete entries at any time. Weekly rituals track one check-in per partner per local week, support either-partner or both-partner completion, and show due reminders only inside the app.

**Tech Stack:** Existing React, TypeScript, Supabase Postgres/Realtime, Node test runner, and pgTAP; no new package.

**Spec:** `docs/superpowers/specs/2026-10-06-relationship-features-and-android-widgets.md`, Stage 13.

## Global Constraints

- Mood check-ins are optional and user-controlled; do not score, diagnose, or claim health benefits.
- Retain a mood entry only until its author deletes it; make sharing state and deletion clear in the UI.
- Couple membership gates all shared rows; private mood rows are readable only by their author.
- Ritual cadence is weekly; reminders are opt-in and in-app only.
- Do not deploy migrations to hosted Supabase or add dependencies.

## Review Focus

- Private mood entries must not appear in partner queries or Realtime payloads.
- A user cannot spoof another author, check in for their partner, or cross couple boundaries.
- Week boundaries must use the couple's selected timezone rather than UTC or device timezone.
- Both-partner rituals remain due until both members check in; either-partner rituals finish on one check-in.
- Deleting a mood entry removes it for its author and partner if it was shared.

---

### Task 1: Mood and ritual domain rules

**Files:** Create `src/lib/moodRituals.ts`; create `tests/moodRituals.test.ts`.

- [x] Add failing tests for accepted mood values, note bounds, ritual fields, couple-local Monday week keys, and either/both participation completion.
- [x] Run `node --test tests/moodRituals.test.ts`; confirm failures describe missing exports/behavior.
- [x] Implement `validateMoodCheckin`, `validateCoupleRitual`, `ritualWeekStart`, and `isRitualComplete` with exact exported types.
- [x] Re-run the focused test file and the full `npm test` suite.

### Task 2: Couple-scoped data and authorization

**Files:** Generate `supabase/migrations/*_stage_13_mood_checkins_rituals.sql` with Supabase CLI; create `supabase/tests/mood_rituals.test.sql`.

- [x] Add pgTAP tests for owner-only private mood visibility, shared mood visibility to the partner, author-only mood edits/deletes, couple-scoped ritual/check-in access, author-derived IDs, weekly duplicate prevention, invalid values, and unrelated-account isolation.
- [x] Run the new pgTAP file and verify the intended authorization assertions fail before implementation.
- [x] Add RLS tables `relationship_mood_checkins`, `couple_rituals`, and `ritual_checkins`; explicitly grant Data API access and publish safe row changes to Realtime.
- [x] Apply the local migration and run the focused pgTAP suite, then the full local database suite.

### Task 3: Shared-space interface

**Files:** Create `src/components/MoodRituals.tsx`; modify `src/components/Us.tsx` and `src/components/Us.css`.

- [x] Add the Stage 13 panel with explicit private/shared mood selection, visible author/date, delete action, weekly ritual creation, participation mode, opt-in in-app reminder, and personal weekly check-in.
- [x] Wire couple ID, timezone, and user ID from the existing shared-space component; subscribe to couple-authorized changes and refresh on visibility/focus.
- [x] Verify keyboard labels, 42px minimum touch controls, loading/error/empty states, and save failure handling.

### Task 4: Verify and record Stage 13

- [x] Use two authenticated local browser sessions to verify private versus shared mood visibility, partner Realtime update, ritual progress in either/both modes, and in-app reminder behavior.
- [x] Inspect the mobile screenshot at 384×832 and both console logs.
- [x] Run `npm test` (148), lint, TypeScript, production build, full local pgTAP (303), security advisors, and `git diff --check`.
- [x] Update `DOCS.md`, `MEMORY.md`, and the roadmap only after all exit checks pass. Keep the migration local.
