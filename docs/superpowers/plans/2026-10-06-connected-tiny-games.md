# Connected Tiny Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add solo, bot, and Realtime friend/partner play for Tic-Tac-Toe, Memory Match, Rock Paper Scissors, and Word Chain, and remove Bored Mode.

**Architecture:** Keep solo and bot games local. Route friend/partner sessions through the existing request and accepted-session flow, with a new RLS-protected public state row for Memory Match and Word Chain and private RPS choices until both players submit. Database functions validate friend relationships, turns, game state, and revisions; the partner is first in the friend picker.

**Tech Stack:** React, TypeScript, Supabase Postgres/RLS/Realtime, pgTAP, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-06-connected-tiny-games-profile-and-drawing-prompts-design.md`

## Global Constraints

- Friends may play Tic-Tac-Toe and the three tiny games; conversation games and Draw Together remain couple-only.
- Solo mode lets one person control both local turns; bot mode plays locally; friend/partner mode uses Supabase.
- Partner appears first, then online confirmed friends, then offline confirmed friends; pending and unconfirmed contacts are excluded.
- RPS partner requests are one simultaneous round; private choices reveal only after both submit.
- No database updates outside server-validated RPCs; preserve request expiry and duplicate prevention.
- Migrations remain local; do not deploy to hosted Supabase.
- No new package dependencies.

## Review Focus

- A pending/unconfirmed contact cannot request or accept a friend game (pgTAP request/accept authorization tests in Task 2).
- A nonparticipant or unrelated user cannot read a friend's session/state (pgTAP RLS test in Task 2).
- A stale revision, wrong turn, duplicate card flip, occupied/missing card, invalid word, repeated word, or tenth-plus word is rejected without state mutation (pure and pgTAP tests in Tasks 1–2).
- A player's RPS pick stays unreadable to the other player until both have chosen; duplicate choices are rejected (pgTAP test in Task 2).
- The partner remains first even when offline and friends have online presence (ordering test in Task 4).

---

### Task 1: Tiny game rules and local bot behavior

**Files:**
- Modify: `src/lib/tinyGames.ts`
- Modify: `tests/tinyGames.test.ts`

**Interfaces:**
- Produce `chooseMemoryBotFlip(game: MemoryGameState, seenPairs: ReadonlyMap<number, string>, random?: () => number): number | null`.
- Produce `chooseWordChainBotWord(words: readonly string[], random?: () => number): string | null`.
- Keep `flipMemoryCard`, `getRockPaperScissorsOutcome`, and `submitWordChainWord` as the shared pure game rules.
- Keep `recommendGames` and `readGameHistory` until Task 6 removes their callers.

- [ ] **Step 1: Add failing tests** named `memory bot uses known pairs before random cards`, `memory bot never selects a matched card`, `word chain bot returns only an unused legal word`, and `word chain bot returns null when no legal word exists`. Inject deterministic random functions and assert the selected card/word.
- [ ] **Step 2: Run** `node --test tests/tinyGames.test.ts`; confirm the new exports are missing or behavior fails.
- [ ] **Step 3: Implement** the two bot selectors with a small built-in word bank and observable seen-card state.
- [ ] **Step 4: Run** `node --test tests/tinyGames.test.ts`; confirm all tiny-game rules pass.

### Task 2: Friend-capable game sessions and protected remote state

**Files:**
- Create: migration using `npx supabase migration new friend_tiny_game_sessions` (use its generated timestamped file under `supabase/migrations/`)
- Create: `supabase/tests/friend_tiny_game_sessions.test.sql`
- Modify: `tests/gameRequestMigration.test.ts`

**Interfaces:**
- Add a private helper that recognizes either a couple relationship or an accepted `friend_requests` relationship for the specific game types `tic-tac-toe`, `memory-match`, `rock-paper-scissors`, and `word-chain`.
- Add `tiny_game_states(session_id uuid PRIMARY KEY, state jsonb NOT NULL, updated_at timestamptz NOT NULL)` with RLS and authenticated SELECT only for the session's two authorized players.
- Add `tiny_game_choices(session_id uuid, user_id uuid, choice text, submitted_at timestamptz, PRIMARY KEY (session_id, user_id))`; RLS permits the owner to read their choice until both submit, then permits either session player to read both.
- Add `submit_tiny_game_action(target_session_id uuid, target_revision integer, target_action jsonb) RETURNS jsonb` for Memory Match flips and Word Chain words; derive caller from `auth.uid()`, lock the session/state rows, validate relationship, game, status, turn and revision, then update state and increment session revision.
- Add `submit_tiny_game_rps_choice(target_session_id uuid, target_choice text) RETURNS jsonb`; allow only one valid choice per participant and set the session completed after both choices.
- Update request creation, acceptance, decline, request/session SELECT policies, and Tic-Tac-Toe move validation to allow accepted friends only for the four game types above; preserve couple-only validation for every other game type.
- Initialize a shuffled Memory Match deck, Word Chain state, and session state when the accepted request creates one of the three tiny-game sessions. Add the public state table to Realtime under its SELECT policy.

- [ ] **Step 1: Write pgTAP tests first** for accepted friend request/accept, unrelated and pending-friend rejection, friend-only session/state reads, memory turn/match/miss/complete transitions, word turn/duplicate/chain/length checks, stale revision rejection, RPS duplicate rejection, and hidden choice isolation before/after both submissions.
- [ ] **Step 2: Run** `npx supabase test db --local`; confirm new assertions fail against the current schema while existing tests remain understood.
- [ ] **Step 3: Create the migration** with `npx supabase migration new friend_tiny_game_sessions`, implement the scoped helper/RPC/RLS/Realtime changes, and leave hosted Supabase untouched.
- [ ] **Step 4: Run** `npx supabase test db --local`; expect all existing and new pgTAP tests to pass.
- [ ] **Step 5: Run** `npm test`; update migration-source assertions to check the new secure function and policies rather than requiring old allowlists.

### Task 3: Friend list and partner-first ordering

**Files:**
- Modify: `src/lib/gamePresence.ts`
- Modify: `src/components/Games.tsx`
- Modify: `tests/gamePresence.test.ts`
- Modify: `tests/gameRequests.test.ts`

**Interfaces:**
- Produce `orderGameRecipients(friends: readonly FriendProfile[], partnerId: string | null, onlineUserIds: ReadonlySet<string>): FriendProfile[]`.
- `Games` loads accepted friend IDs and profiles using the existing RLS-readable `friend_requests` and `profiles` tables; `get_couple_partner` identifies the partner to place first.
- The chosen recipient is passed to the existing `createGameRequest(recipientId, gameId)` flow.

- [ ] **Step 1: Add failing ordering tests** for partner-first while offline, then online friends, then offline friends, with no duplicates.
- [ ] **Step 2: Run** `node --test tests/gamePresence.test.ts`; verify the new export/test fails.
- [ ] **Step 3: Implement** recipient loading and ordering; exclude pending and unaccepted requests.
- [ ] **Step 4: Run** `node --test tests/gamePresence.test.ts tests/gameRequests.test.ts`.

### Task 4: Three play modes and local bots

**Files:**
- Modify: `src/components/Games.tsx`
- Modify: `src/components/games/TinyGame.tsx`
- Modify: `src/components/games/TinyGame.css`
- Modify: `src/components/games/TicTacToe.tsx`
- Modify: `src/lib/gameCatalog.ts`
- Modify: `tests/gameCatalog.test.ts`

**Interfaces:**
- Use `GameMode = 'directory' | 'mode-picker' | 'friend-picker' | 'bot' | 'remote' | 'solo'` in `Games`.
- Add `mode: 'solo' | 'bot' | 'remote'` to `TicTacToe`; use `mode: 'solo' | 'bot'` for local `TinyGame` and retain remote rendering in a separate remote game component.
- Solo allows the signed-in user to act for either local player; bot allows only user turns and applies tested game-specific bot moves.
- Mark Memory Match, Rock Paper Scissors, and Word Chain as partner-capable in the game catalog.

- [ ] **Step 1: Add mode picker tests** proving the three tiny games are partner-capable and their choices include solo, bot, and people.
- [ ] **Step 2: Run** `node --test tests/gameCatalog.test.ts`; confirm the new capability assertions fail.
- [ ] **Step 3: Implement** the mode picker and bot/solo behavior; keep choices on device in solo and bot modes.
- [ ] **Step 4: Run** `node --test tests/tinyGames.test.ts tests/gameCatalog.test.ts` and `npx tsc --noEmit`.

### Task 5: Remote tiny-game screen and session routing

**Files:**
- Create: `src/components/games/RemoteTinyGame.tsx`
- Create: `src/lib/tinyGameSessions.ts`
- Modify: `src/components/Games.tsx`
- Modify: `src/components/Hub.tsx`
- Modify: `src/lib/gameSessions.ts`
- Modify: `src/lib/gameRequests.ts`
- Modify: `src/components/games/TinyGame.css`
- Create: `tests/tinyGameSessions.test.ts`

**Interfaces:**
- `TinyPublicState` is a union of `{ game_type: 'memory-match'; cards: { id: number; pair: string | null }[]; revealed: number[]; matched: number[]; scores: [number, number] }`, `{ game_type: 'word-chain'; words: string[] }`, and `{ game_type: 'rock-paper-scissors' }`. The database stores the deck in a private table; public state reveals pair values only for currently revealed or matched cards.
- `TinyGameAction` is `{ type: 'flip'; index: number } | { type: 'word'; word: string }`.
- `getTinyGameState(sessionId: string): Promise<TinyGameState>` loads the authorized game session, public state, and caller's private choice.
- `submitTinyGameAction(sessionId: string, revision: number, action: TinyGameAction): Promise<TinyGameState>` and `submitTinyGameRpsChoice(sessionId: string, choice: RockPaperScissorsChoice): Promise<TinyGameState>` call only their matching RPCs.
- `RemoteTinyGame` subscribes to `game_sessions`, `tiny_game_states`, and RPS choices; refetches on subscription/focus; merges state by session revision; renders the same game-specific board with private RPS waiting/reveal states.

- [ ] **Step 1: Add failing client tests** for exact RPC argument names, rejection propagation, and stale-session merge behavior.
- [ ] **Step 2: Run** `node --test tests/tinyGameSessions.test.ts`; confirm the module or assertions fail before implementation.
- [ ] **Step 3: Implement** the client functions and remote screen; include tiny-game types in Hub active-session discovery and route by `game_type` after request acceptance.
- [ ] **Step 4: Run** `node --test tests/tinyGameSessions.test.ts tests/gameRequestMigration.test.ts` and `npx tsc --noEmit`.

### Task 6: Remove Bored Mode and obsolete recency state

**Files:**
- Modify: `src/components/Games.tsx`
- Modify: `src/components/Games.css`
- Modify: `src/lib/gameCatalog.ts`
- Modify: `tests/gameCatalog.test.ts`
- Modify: `tests/tinyGames.test.ts`

- [ ] **Step 1: Add a failing catalog assertion** that Stage 5 metadata no longer advertises Bored Mode and the directory renders without a recommendations region.
- [ ] **Step 2: Run** `node --test tests/gameCatalog.test.ts tests/tinyGames.test.ts`; verify the new catalog assertion fails.
- [ ] **Step 3: Delete** the recommendation panel, recency interval/localStorage tracking, related imports/styles/helpers/tests, and update Stage 5 metadata title.
- [ ] **Step 4: Run** `node --test tests/gameCatalog.test.ts tests/tinyGames.test.ts`.

### Task 7: End-to-end verification

**Files:**
- Modify: `DOCS.md`
- Modify: `MEMORY.md`

- [ ] **Step 1: Run** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx supabase test db --local`, and `git diff --check`.
- [ ] **Step 2: Run two local authenticated browser accounts** through all three tiny games with partner and confirmed-friend requests; verify receiving, accepting, private RPS choices, Realtime updates in both directions, solo and bot modes, and partner-first ordering.
- [ ] **Step 3: Inspect screenshots** of mode picker, active shared board, RPS waiting/reveal, and local modes at desktop and 384×832 CSS pixels; inspect console, keyboard use, tap targets, and horizontal overflow.
- [ ] **Step 4: Only if all checks pass, update** Stage 5 text in `DOCS.md`, record exact evidence in `MEMORY.md`, and check off the relevant scope. Do not claim a browser, account, or database check that did not run.
