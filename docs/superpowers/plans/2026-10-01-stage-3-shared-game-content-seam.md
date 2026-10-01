# Stage 3 Shared Game and Content Seam Implementation Plan

> **For agentic workers:** Use native execution in this session, task by task. Steps use checkbox syntax for tracking.

**Goal:** Generalize the existing remote game lifecycle and prove it with Tic-Tac-Toe plus one hidden-answer game while preserving participant-only access and server-controlled reveal.

**Architecture:** Keep the static catalog and shared request/session lifecycle in small TypeScript modules. Extend the existing tables with a narrowly defined second game type and session deadline, and store hidden answers in a separate participant-owned table whose RLS reveal rule exposes rows only after both submissions or the server deadline. Keep Tic-Tac-Toe state transitions on its existing RPC.

**Tech Stack:** React, TypeScript, Node built-in tests, Supabase PostgreSQL migrations and pgTAP, Vite.

**Spec:** `docs/superpowers/specs/2026-09-30-shared-playground-roadmap.md`, Stage 3.

## Global Constraints

- Do not add a game framework, backend server, package, generic event table, or client write path around RLS.
- Preserve Tic-Tac-Toe request, acceptance, session, move, and realtime behavior.
- Reuse the canonical couple membership check and authenticated Supabase client.
- Keep private submissions unavailable to the other participant until both submit or `deadline_at <= now()`.
- Do not claim hosted or two-account verification unless performed.

## Review Focus

- A one-sided answer submission must remain private; pgTAP verifies the partner cannot select it.
- The second answer unlocks both rows; pgTAP verifies both participants can select.
- An expired hidden-answer round reveals submissions based on database time; pgTAP verifies this without trusting the client.
- Unrelated users cannot read submissions or submit to another couple's session; pgTAP verifies both denials.
- Existing Tic-Tac-Toe moves, request expiry, and request acceptance remain unchanged; Node and pgTAP regressions cover them.

## File Map

- Create `src/lib/gameCatalog.ts`: IDs and shared display/lifecycle metadata.
- Modify `src/lib/gameRequests.ts`: use the shared game ID type while keeping the existing default request payload unchanged.
- Modify `src/lib/gameSessions.ts`: shared session shape and RPC adapters; preserve Tic-Tac-Toe-specific move validation/RPC.
- Create `src/lib/gameSubmissions.ts`: hidden-answer payload and answer types/rules.
- Create `tests/gameCatalog.test.ts` and `tests/gameSubmissions.test.ts`; extend existing request/session tests.
- Create `supabase/migrations/20261001043638_stage_3_shared_game_content_seam.sql`: widen game checks, add session deadline, add private submissions and submit RPC, and add participant/reveal-aware policies.
- Create `supabase/tests/shared_game_content.test.sql` for submission privacy, deadline reveal, and cross-couple denial.
- Update `docs/superpowers/specs/2026-09-30-shared-playground-roadmap.md`, `DOCS.md`, and `MEMORY.md` after checks pass.

## Task 1: Shared game catalog and TypeScript types

**Interfaces:**
- `GameId = 'tic-tac-toe' | 'would-you-rather'`.
- Catalog entries provide `id`, `label`, `durationMinutes`, and `kind: 'turn-based' | 'hidden-answer'`.
- `GameSession.game_type` and `GameRequest.game_type` use `GameId`.

- [x] Add failing tests for both catalog entries, discriminating kinds, request default payload, and existing Tic-Tac-Toe session helpers.
- [x] Run a focused catalog test and confirm the missing module failure.
- [x] Implement the catalog and minimal shared type changes; keep existing Tic-Tac-Toe routing and behavior.
- [x] Run focused tests, then `npm test` (75 passed).

## Task 2: Hidden-answer rules and API contract

**Interfaces:**
- `type WouldYouRatherAnswer = 'left' | 'right'`.
- `hiddenAnswerInsertPayload(sessionId, answer)` returns the session ID and answer only; user identity is always taken from `auth.uid()` in SQL.
- Game deadline display is derived from `deadline_at`; the database remains authoritative.

- [x] Add failing tests for valid answers, invalid answer rejection, identity-free payload, and UUID-safe session subscription filters.
- [x] Run the targeted Node test and confirm the missing module failure.
- [x] Implement pure answer validation/payload, the session RPC adapter, and UUID-safe subscription filter needed by the shared seam.
- [x] Run targeted tests and the full Node suite (75 passed).

## Task 3: Database schema, submission lifecycle, and authorization

**Interfaces:**
- `game_requests.game_type` and `game_sessions.game_type` accept `tic-tac-toe` and `would-you-rather`.
- `game_sessions.deadline_at` is nullable `timestamptz`; non-null values determine reveal/expiry against database `now()`.
- `game_submissions(session_id, user_id, answer, submitted_at)` has a unique `(session_id, user_id)` constraint and couple-member ownership through the session.
- `submit_hidden_game_answer(target_session_id uuid, target_answer text)` takes the caller from `auth.uid()`, accepts only active `would-you-rather` sessions before deadline, permits one immutable answer per participant, and returns only status/count (never the partner answer before reveal).
- Reads of submission rows allow the owner at all times and both players after both have submitted or deadline has passed.

- [x] Add pgTAP checks for hidden row access before reveal, both-row access after both submit, deadline reveal, invalid answer/game/status/deadline, duplicate submission, direct write denial, and unrelated participant denial.
- [x] Run `supabase db reset` and `supabase test db`; confirm expected missing-schema/RPC failures before implementation.
- [x] Add the migration and policy/RPC logic using `public.are_couple_members`, a locked session row, and database time.
- [x] Run `supabase db reset` and `supabase test db`; 57 local pgTAP checks pass.
- [x] Verify `supabase db diff --local` is empty and active migrations replay from the authoritative baseline.

## Task 4: Final regression, UI browser inspection, and records

- [x] Run `npm test` (77 passed), `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` after the final edits.
- [ ] Run the app and inspect the existing Tic-Tac-Toe flows at mobile and desktop viewports; capture screenshots and check browser console. The CUA browser surface is unavailable, and the Playwright browser download did not complete; this item remains pending.
- [x] Record hosted migration/two-account verification limits plainly; no hosted database writes were made.
- [ ] Mark Stage 3 complete in `DOCS.md` and the roadmap only if every required check passes; update `MEMORY.md` with results and limitations.

## Self-review

- Spec coverage: static catalog/shared game IDs, common metadata, session deadline, lifecycle, authorized subscription filter, private submissions, deadline/both-player reveal, and Tic-Tac-Toe preservation each have an owning task.
- Type consistency: both request and session rows use `GameId`; only Tic-Tac-Toe move APIs retain board-specific types; hidden answers use a separate API and table.
- Review focus cases are explicitly tested in the owning TypeScript or pgTAP task.
- No extra UI, installed content dataset, framework, or hosted schema write is included; this slice establishes the reusable seam for Stage 4 games.
