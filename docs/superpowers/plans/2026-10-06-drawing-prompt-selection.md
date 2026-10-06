# Drawing Prompt Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let both players see a drawing subject and classification chosen from the supplied prompt list or entered by the requester, independently of an optional reference image.

**Architecture:** Store `subject` and `category` on `drawing_rounds`, set them only through the requester-only `start_drawing_round` RPC, and load them through the existing couple-scoped round query. Keep the original prompt list in a typed client catalog grouped by its supplied classification.

**Tech Stack:** React, TypeScript, Supabase Postgres/RLS/Realtime/Storage, pgTAP, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-06-connected-tiny-games-profile-and-drawing-prompts-design.md`

## Global Constraints

- Presets come from the user's supplied list and retain each item's topic/classification.
- The requester chooses a preset category+subject or enters both a custom subject and category.
- Subject is trimmed and 1–120 characters; category is trimmed and 1–60 characters.
- Prompt selection is independent of the optional JPEG/PNG/WebP reference image.
- The existing timer presets, custom 15–600-second duration, couple-only access, and private drawings remain unchanged.
- Migration stays local; no hosted schema changes and no added dependency.

## Review Focus

- Empty, whitespace-only, or oversized custom subject/category values are rejected by both client validation and the start-round RPC (pure and pgTAP tests in Tasks 1 and 3).
- The client recognizes only exact preset subject/category pairs; custom values are accepted after trimming and length validation (pure tests in Task 1).
- A non-requester cannot select or mutate prompt metadata after the round starts (pgTAP test in Task 3).
- A partner sees the same saved subject/category after Realtime update and reload, even with no reference image (browser verification in Task 4).
- Existing waiting/completed rows with null prompt columns remain readable, and legacy timer callers are removed before dropping the old RPC (migration test in Task 3).

---

### Task 1: Prompt catalog and validation rules

**Files:**
- Create: `src/lib/drawingPrompts.ts`
- Create: `tests/drawingPrompts.test.ts`
- Modify: `tests/drawingGame.test.ts`

**Interfaces:**
- `DRAWING_PROMPTS: readonly { subject: string; category: string }[]` contains all entries from the user-supplied file.
- `drawingCategories(): string[]` returns distinct categories in first-seen order.
- `drawingSubjectsForCategory(category: string): string[]` returns subjects from that category.
- `validateDrawingPrompt(subject: string, category: string): { subject: string; category: string }` returns trimmed values or throws when either is empty or exceeds its spec limit.
- `isPresetDrawingPrompt(subject: string, category: string): boolean` checks the exact catalog pair.

- [ ] **Step 1: Write failing tests** for first-seen category ordering, every pasted subject/classification pair, category filtering, exact pair matching, trimmed custom values, whitespace-only values, and 120/60-character boundaries.
- [ ] **Step 2: Run** `node --test tests/drawingPrompts.test.ts`; confirm the catalog/helpers are missing.
- [ ] **Step 3: Add** the supplied entries and implement the small pure selectors/validator.
- [ ] **Step 4: Run** `node --test tests/drawingPrompts.test.ts tests/drawingGame.test.ts`.

### Task 2: Draw Together prompt setup and shared display

**Files:**
- Modify: `src/components/games/DrawingGame.tsx`
- Modify: `src/components/games/DrawingGame.css`
- Modify: `src/lib/gameSessions.ts`

**Interfaces:**
- Add `subject: string | null` and `category: string | null` to `DrawingRound` for legacy rows.
- Change client call to `startDrawingRound(sessionId: string, durationSeconds: number, subject: string, category: string, referencePath: string | null): Promise<DrawingRound>`.
- Setup has category selector, matching subject selector, and a custom entry path exposing subject/category text fields. A preset is accepted only as a catalog pair.
- Show saved `category` and `subject` to both users during the active and reveal states. The recipient receives them via the existing round read/realtime refresh.

- [ ] **Step 1: Extend pure/UI-facing tests** to verify setup choices remain independent of reference selection and invalid custom prompts cannot start.
- [ ] **Step 2: Run** `node --test tests/drawingPrompts.test.ts tests/drawingGame.test.ts`; confirm the new prompt-related assertions fail.
- [ ] **Step 3: Implement** selector/custom input UI, validation through `validateDrawingPrompt`, updated RPC arguments, and prompt display in active/reveal views. Leave file upload optional.
- [ ] **Step 4: Run** the focused tests, `npx tsc --noEmit`, and `npm run lint`.

### Task 3: Persist and validate prompts in Postgres

**Files:**
- Create: migration using `npx supabase migration new drawing_round_prompts` (use the generated timestamped path under `supabase/migrations/`)
- Create: `supabase/tests/drawing_round_prompts.test.sql`

**Interfaces:**
- Add nullable `subject text` and `category text` columns for backwards-compatible historical rounds; when non-null enforce trimmed lengths of 1–120 and 1–60.
- Drop the old three-argument `start_drawing_round(uuid, integer, text)` function and replace it with `start_drawing_round(target_session_id uuid, target_duration_seconds integer, target_subject text, target_category text, target_reference_path text DEFAULT NULL)`; keep authenticated execution only.
- RPC requires the authenticated requester, active Draw Together session, waiting round, valid duration, and valid trimmed non-empty subject/category within limits; preserve existing reference path/type/size validation. Preset pair matching remains client-side because the catalog is not duplicated in SQL.
- Persist subject/category atomically with status, start timestamp, deadline, and optional reference path so Realtime emits one round update.

- [ ] **Step 1: Write pgTAP tests first** for custom prompt trimming, empty/oversized values, non-requester denial, timer bounds, optional null reference, and historical null rows. Task 1 covers exact preset pair matching.
- [ ] **Step 2: Run** `npx supabase test db --local`; confirm new assertions fail against the existing schema/function.
- [ ] **Step 3: Create** the migration with `npx supabase migration new drawing_round_prompts`; add nullable fields/checks and replace the function, retaining its current security-definer search path and authorization discipline.
- [ ] **Step 4: Run** `npx supabase test db --local`; expect all existing and prompt pgTAP tests to pass.
- [ ] **Step 5: Run** `npm test` and `npx tsc --noEmit`; confirm the app calls only the new RPC signature.

### Task 4: Two-account visual verification and documentation

**Files:**
- Modify: `DOCS.md`
- Modify: `MEMORY.md`

- [ ] **Step 1: Run** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx supabase test db --local`, and `git diff --check`.
- [ ] **Step 2: In two authenticated local browser contexts**, choose a preset in one client and verify the exact classification and subject appear in the partner's active round after Realtime and reload; repeat with custom text.
- [ ] **Step 3: Start a round with no reference image**, draw and reveal as before, verify duration and reference controls are unchanged, capture/inspect desktop and 384×832 CSS-pixel screenshots, and inspect browser console and touch/keyboard input.
- [ ] **Step 4: Update** `DOCS.md` and `MEMORY.md` with exact evidence only after all checks pass. Keep the migration local.
