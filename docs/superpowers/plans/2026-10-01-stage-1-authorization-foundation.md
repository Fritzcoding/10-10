# Stage 1: Relationship and Authorization Foundation

> **Execution:** Native, inline, one stage at a time. Stage 2 starts only after this stage's exit criteria pass.

**Goal:** Make the existing two-person relationship the database authorization boundary and make remote Tic-Tac-Toe moves atomic and legal.

**Architecture:** Add a canonical couple plus two unique memberships, with database pairing and game RPCs. Keep the current React/Vite/Supabase client; narrow profile lookup, message access, and game visibility through RLS. Use a revision checked transaction for every remote move and remove the fixed broadcast room from user gameplay.

**Tech Stack:** Existing Supabase Postgres migration, RLS, SECURITY DEFINER RPCs with pinned search paths and explicit grants, `supabase test db`/pgTAP, existing React TypeScript client and Node tests.

**Spec:** `docs/superpowers/specs/2026-09-30-shared-playground-roadmap.md`, Stage 1 and Privacy and Security Requirements.

## Global constraints

- Do not change the hosted application schema during this stage; author and validate a local migration only.
- Preserve existing historical migration SQL and all pre-existing working-tree changes.
- Only infer a legacy couple from reciprocal profile links, or from one accepted partner request whose pair matches a one-way legacy profile link; exclude ambiguous/conflicting members.
- Authorization comes from couple membership, never profile fields or user-editable metadata.
- RLS protects reads/writes; SECURITY DEFINER RPCs validate caller identity and all state transitions.
- Do not claim a real two-account hosted test; use local database identities and report the limit.
- Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` before marking the stage complete.

## Files and interfaces

- `supabase/migrations/<stage-1 migration>`: canonical couple/membership tables, safe backfill, relationship/profile/message/game policies, pairing/respond RPC, revision-checked move RPC, and function grants.
- `supabase/tests/relationship_authorization.test.sql`: local pgTAP RLS, backfill, pairing, and RPC assertions.
- `src/lib/friendSearch.ts`, `src/components/Friends.tsx`: use exact-match authenticated profile-search RPC and server-side request-response RPC; keep existing request UI.
- `src/components/PartnerStatus.tsx`: show only database-backed canonical pairing.
- `src/lib/gameSessions.ts`, `src/lib/gameRequests.ts`, `src/components/games/RemoteTicTacToe.tsx`: pass session revision to move RPC and handle stale revisions by reloading server state.
- `src/components/games/TicTacToe.tsx`: remove the fixed shared broadcast channel; bot and server-backed remote play remain.
- `tests/friendSearch.test.ts`, `tests/gameSessions.test.ts`, and new focused tests: verify the client calls the RPC contract and handles stale state.
- `docs/superpowers/specs/2026-09-30-shared-playground-roadmap.md`, `DOCS.md`, `MEMORY.md`: record evidence and stage status only after checks pass.

## Tasks

### Task 1: Canonical couple and relationship authorization

- [x] Add pgTAP checks first for one-member membership, RLS self/partner/unrelated profile access, non-couple chat denial, exact profile lookup, accepted partner-request backfill, and conflicting legacy-link exclusion.
- [x] Run the checks against the local baseline and observe failures caused by the missing canonical schema and policies.
- [x] Create the migration with `supabase migration new`; implement `couples`, unique `couple_members.user_id`, guarded/atomic partner acceptance, a narrowly scoped exact email/UID lookup RPC, and the RLS/grants needed by existing requests and chat.
- [x] Backfill reciprocal links. Also repair a one-way link only when exactly one accepted partner request proves the same pair; never backfill a partial/conflicting pair.
- [x] Run `supabase db reset` and `supabase test db --local`.

### Task 2: Transactional game sessions

- [x] Add database checks for participant-only reads, rejection of direct session writes, wrong-player/out-of-turn/occupied-cell/finished-game/stale-revision move rejection, and successful concurrent revision progression.
- [x] Add `revision` and an authenticated move RPC that locks the row, verifies couple membership, checks the expected revision and legal Tic-Tac-Toe move, then updates board/outcome/revision atomically.
- [x] Make session and game-request visibility couple-scoped; route request acceptance and decline through validated database operations as needed.
- [x] Update the existing client and pure rule tests to use the RPC revision contract; remove the fixed public Realtime broadcast channel from normal play.
- [x] Run local pgTAP, the focused Node tests, and the full app checks.

### Task 3: Stage review and handoff

- [x] Inspect the final diff for authorization gaps and unintended edits; local UI behavior remains covered by existing tests and source review.
- [x] Update Stage 1 documentation and MEMORY after local exit checks passed.
- [x] Leave missing real-account or hosted verification clearly unclaimed.

## Review focus

- A user with no couple membership can neither read profiles beyond exact discovery nor read messages or sessions.
- A profile search input must be one exact email or UID, never a wildcard enumeration query.
- A member cannot create a second couple through simultaneous accepted partner requests.
- A duplicate move with the same revision cannot overwrite a newer board.
- A finished game, wrong player, occupied square, malformed cell, or unexpected board cannot be accepted by the RPC.

## Exit criteria

Local pgTAP (32 checks) proves unrelated users cannot read couple-scoped data, arbitrary recipients cannot receive chat, and only an authenticated couple member can submit a legal, revision-current game move. Existing app tests (67), lint, typecheck, and build pass. `git diff --check` reports only the pre-existing `.gitignore:86` blank line. Hosted schema remains unchanged and the Stage 1 migration is not applied remotely.
