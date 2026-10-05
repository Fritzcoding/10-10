# Shared Playground Stage 5 Implementation Plan

> **For agentic workers:** Implement task-by-task with tests first; keep every game local-first and avoid new dependencies or database changes.

**Goal:** Add three quick pass-and-play games and a Bored Mode that recommends a fitting, explainable game without repeatedly choosing one played recently.

**Architecture:** Keep game rules pure in `src/lib/tinyGames.ts`; render each game locally from the existing Games directory. Add duration/availability metadata to the catalog and a small recommender that uses the selected time, current partner presence, and per-user device-local play history.

**Tech Stack:** React, TypeScript, browser localStorage, Node test runner; no new packages or Supabase schema changes.

**Spec:** `docs/superpowers/specs/2026-09-30-shared-playground-roadmap.md`, Stage 5.

## Global Constraints

- Games are local-first and phone-friendly.
- Recommendations use available time, partner availability, and recency.
- When alternatives fit, avoid games played recently and explain each recommendation.
- No new dependency, hosted migration, or Stage 6–8 feature.

## Review Focus

- No game fits the selected time: show a clear no-fit state and let the user change time.
- Partner is offline: exclude games that require a partner; local games remain available.
- Storage is missing, malformed, or unavailable: recommendations still work with empty history.
- A recently played game is the only fit: recommend it rather than showing no result.
- Repeated turns/input in tiny games: reject invalid choices and preserve the current state.

---

### Task 1: Pure local game rules and recommendations

**Files:** Create `src/lib/tinyGames.ts`; create `tests/tinyGames.test.ts`.

**Interfaces:** `createMemoryGame(pairs) -> MemoryGameState`; `flipMemoryCard(state, index) -> MemoryGameState`; `getRockPaperScissorsOutcome(first, second) -> 'player-1' | 'player-2' | 'tie'`; `submitWordChainWord(words, input) -> string[] | null`; `recommendGames(catalog, { availableMinutes, partnerOnline, recent, now? }) -> GameRecommendation[]`; `readGameHistory(serialized) -> Record<string, number>`. Catalog availability is `'local' | 'partner' | 'either'`; recency means the last seven days.

- [ ] Write tests for pair matching/mismatch, duplicate card selection, RPS outcomes, word-chain normalization/duplicate rejection, time fit, partner availability, recency suppression, fallback when all candidates are recent, and malformed local history.
- [ ] Run `npm test -- --test-name-pattern=tinyGames`; confirm failure is from missing functions.
- [ ] Implement the minimum pure helpers and rerun focused tests.

### Task 2: Catalog and local game screens

**Files:** Modify `src/lib/gameCatalog.ts`, `tests/gameCatalog.test.ts`, `src/components/Games.tsx`, `src/components/Games.css`; create `src/components/games/TinyGame.tsx` and `src/components/games/TinyGame.css`.

**Interfaces:** Add game IDs and duration/availability metadata. `TinyGame` accepts one of the three new game IDs and renders same-device play. Keep per-user recency in `couple-game-history:<userId>` localStorage; catch storage read/write failures. Keep existing request/session flows unchanged.

- [ ] Add catalog tests for the three game entries, durations, and local availability.
- [ ] Add all three games as phone-sized touch/keyboard-accessible views with clear reset/exit controls and concise instructions.
- [ ] Add Bored Mode time choices, partner-aware recommendations, and a visible reason for each result.
- [ ] Run focused tests, typecheck, and lint.

### Task 3: Full verification and records

**Files:** Modify `tests/gameCatalog.test.ts` if needed, `DOCS.md`, `MEMORY.md`, and the Stage 5 roadmap checklist only after checks pass.

- [ ] Inspect the local browser at phone width; play through all three games, inspect recommendation reasons, and check console and horizontal overflow.
- [ ] Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
- [ ] Check off Stage 5 and update `DOCS.md`/`MEMORY.md` only if the exit criteria and required checks pass; report any unavailable two-account/device verification.
