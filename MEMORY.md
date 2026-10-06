# Project Memory

- Micro-Stage 4.1 is complete: `Hub` renders a full-screen styled couple backdrop and resumes the shared background audio.
- Micro-Stage 4.2 is complete: `PartnerStatus` reads partner details from Supabase user metadata/profile data and renders paired or unpaired status.
- Micro-Stage 4.3 is complete: `BottomNav` provides Games, Friends, and Settings tabs that switch the Hub panel.

## Current progress

- Micro-Stage 1.2 is complete: the initial Vite app foundation and Supabase client integration are present.
- Micro-Stage 2.1 is complete: `BirthdayScroll` now renders on app load as a mobile-first birthday message scroll popup.
- The popup includes an accessible `Accept & Continue` button that transitions to a short celebration confirmation.

## Verification

- TypeScript verification: `npx tsc --noEmit`
- Production build verification: `npm run build`

## New completed stages

- Micro-Stage 2.2 is complete: `BirthdayScroll` starts looping background music through the shared audio helper when the user continues.
- Micro-Stages 3.1 and 3.2 are complete: the glassmorphism auth modal supports login/register email-password flows through Supabase Auth and transitions to the Hub after authentication.
- Micro-Stage 5.1 is complete: `Friends` searches profiles by email, sends friend requests, lists confirmed friends, and accepts incoming requests through Supabase.
- Micro-Stage 5.2 is complete: `Friends` sends partner requests and accepts them by updating reciprocal `profiles.partner_id` and `profiles.partner_name` values.
- Micro-Stage 5.3 is complete: `Settings` controls shared background music volume, updates Supabase display-name metadata, and logs out through the app state reset callback.
- Micro-Stage 5.4 is complete: `Settings` displays and copies the signed-in user UID; `Friends` centers confirmed friends, supports UID discovery, prevents duplicate requests in either direction, and shows incoming/outgoing friend and partner requests.
- Friends discovery now searches the numeric `profiles.display_uid` or email and renders results as `UID: #<display_uid>`.
- Profile initialization now ensures authenticated users have a `profiles` row before Friends or Settings reads `display_uid`; search branches email and numeric UID queries to avoid mixed-type PostgREST filters.
- Micro-Stage 6.1 is complete: `Games` renders a mobile-optimized game directory grid with a Tic-Tac-Toe card that opens the active game view.
- Micro-Stage 6.2 is complete: `TicTacToe` renders a responsive, touch-friendly glassmorphism 3x3 board with turn status and reset controls.
- Micro-Stage 6.3 is complete: `TicTacToe` uses the Supabase Realtime `game_room_id` channel to broadcast and receive `move` events containing the board and current turn.
- Friends search now branches on `/^\d+$/.test(input.trim())`, using numeric `display_uid` equality only for numeric input and case-insensitive email matching otherwise.
- Friends profile loading and search loading always reset in `finally`; unavailable profile UIDs render as `UID: #--`.
- UID search now selects only renderable profile fields, keeps the result card after adding, and provides direct realtime chat through the RLS-protected `direct_messages` table.
- The deployed Supabase project must apply the new direct-message and friend-discovery policy migrations for cross-user search, friend-request insertion, and chat to work under RLS.
- Search regression coverage now executes the numeric UID path with a query executor double and verifies UID `6` returns the expected profile; search readiness failures are surfaced instead of silently ignored.
## Remote multiplayer games

- Friend Tic-Tac-Toe uses Supabase requests/sessions with a 60-second guarded acceptance window.
- Bot play is local; incoming requests render in the persistent Hub banner.
- Browser push is optional; persisted notifications are the source of truth.

## Pairing and request reliability fixes

- Pending game requests are filtered by `expires_at` in the client and stale rows are expired server-side by `202609300001_expire_game_requests.sql`; duplicate active sends return the existing request.
- Online friend selection now names the online friends, instead of only showing a generic online state.
- Hub-level `game_sessions` realtime routing switches both players into the accepted Tic-Tac-Toe session.
- Partner status prefers profile columns and listens for realtime profile updates, so both accounts refresh their pairing label.
- Debug follow-up: friend profiles now load email and use `display_name`, then email, then UID as the visible identity; missing `create_game_request` RPC errors now identify the required migration instead of collapsing into "Unable to send the game request."
- The first request RPC migration had an ambiguous `recipient_id` parameter; corrective migration `202609300002_fix_game_request_recipient_reference.sql` renames it to `target_recipient_id`, and the client payload now matches that name.
- The corrective migration must drop `public.create_game_request(uuid)` before recreating it because PostgreSQL does not allow renaming an existing input parameter with `CREATE OR REPLACE FUNCTION`.
- Acceptance had the same collision in `accept_game_request(request_id uuid)`; `202609300003_fix_accept_game_request.sql` drops/recreates it with `target_request_id`, and the banner now surfaces actionable acceptance migration errors.
- Hub now shows the signed-in display UID in a compact top-right badge. A local `?dev=pairing` harness simulates UID 5 and UID 6 request, acceptance, expiry, and shared moves for two-account browser verification without Supabase writes.
- `202609300001_expire_game_requests.sql` is now safe to rerun after `202609300002` because it drops the existing function before recreating it with `target_recipient_id`.
- Automated verification passed: 61 tests, `npx tsc --noEmit`, lint, build, and diff-check. Browser harness screenshot verification passed with zero console errors; real Supabase two-account verification still requires migrations and signed-in sessions.

## Shared Playground roadmap (2026-09-30)

- User approved the staged shared-playground direction and requested a persistent Markdown roadmap before implementation.
- Roadmap/spec: `docs/superpowers/specs/2026-09-30-shared-playground-roadmap.md`.
- Written roadmap is pending user review. Do not start feature implementation until reviewed; then create a bite-sized plan and complete one stage at a time.
- Baseline recheck: `npm test` passed (61), `npm run lint` passed, and `npm run build` passed. `git diff --check` reports a pre-existing extra blank line at EOF in `.gitignore` line 86; this audit did not alter it.
- No browser surface was available during the audit. Vite started locally, but visual/mobile inspection and browser console verification could not be performed.
- Existing worktree changes predate this roadmap task and were left untouched.

## Stage 0 audit (2026-09-30)

- User authorized Stage 0 only; later stages must not start before each current stage passes its exit criteria.
- Hosted Supabase catalog was inspected read-only: public tables are `profiles`, `friend_requests`, `direct_messages`, `game_requests`, `game_sessions`, `notifications`, and `push_subscriptions`; no canonical couple table exists.
- Hosted migration listing returned no app migrations, and `information_schema` showed no app `supabase_migrations` table. The repository has nine feature migrations but no base schema, `supabase/config.toml`, or seed; migration lineage cannot be reconciled safely.
- At first inspection Supabase CLI/Docker were unavailable. After user supplied CLI setup artifacts, the linked project was verified and a schema-only snapshot was obtained; `.env` files remain unread.
- Hosted RLS review found a permissive `profiles` SELECT policy (`USING true`), chat insert not restricted to a relationship, and participant `game_sessions` UPDATE policy without server-side legal-move/revision checks. Realtime authorization policies were not found in `realtime`.
- Security advisors reported publicly executable SECURITY DEFINER functions (including request RPCs and profile helpers), mutable search path on `handle_new_user`, and disabled leaked-password protection.
- Current checks: `npm test` 61/61 passed; lint passed; `npx tsc --noEmit` passed; build passed with ineffective-dynamic-import warnings; `git diff --check` failed on the pre-existing extra blank line at `.gitignore:86`.
- Browser surface was unavailable; source and test behavior reviewed, but no current visual/browser interaction verification performed. No two-account Supabase test was performed.
- At the initial audit, Stage 0 was blocked; no application or database changes were made during that audit. The follow-up baseline adoption is recorded below.
- Follow-up Git-history inspection covered all 11 reachable commits and found no base-schema migration; only the six feature migrations in repository history plus three current untracked request fixes exist. A hosted schema snapshot cannot safely substitute for the missing migration lineage.
- User supplied the CLI setup artifacts in `%TEMP%\couple-app-schema-audit`: the linked project ref matches the hosted project, `supabase migration list --linked` reports no recorded migrations, and the schema-only dump has seven public tables, 16 policies, and four functions. It contains no row COPY/INSERT statements; credential-pattern scan only matched the standard `service_role` label, no credential value was exposed.
- `npx supabase status` confirms the CLI runs but local replay is unavailable: Docker reports `No such container: supabase_db_couple-app`. The schema snapshot is outside the repository and no reproducible local baseline can yet be demonstrated.
- Recheck: 61 tests, lint, `npx tsc --noEmit`, and build pass. `git diff --check` still fails only on the pre-existing extra blank line at `.gitignore:86`; build reports two ineffective dynamic-import warnings. No user changes were modified.
- Snapshot replay succeeded in a disposable local Supabase stack, but replaying repository migrations alone fails at `202609240001` because `public.profiles` is missing. Adding the deployed snapshot as an earlier baseline then fails at `202609280001` because policy `game requests visible to participants` already exists. Hosted migration history is empty, so deployment lineage is not reconciled.
- At that point the CLI connection had not resolved the migration gap; later read-only investigation established a baseline strategy, followed by the verified Stage 0 adoption below.
- User clarified that migration SQL was applied manually and designated the hosted schema as authoritative. Read-only RPC/catalog checks confirm live `create_game_request(target_recipient_id)` and `accept_game_request(target_request_id)` signatures plus expected policies and realtime publication entries.
- Baseline strategy was tested in disposable scratch projects: a raw `supabase db dump --linked --schema public` file plus `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users ... EXECUTE FUNCTION public.handle_new_user()` replays locally and yields an empty `supabase db diff --linked`. The raw dump contains seven tables, 16 policies, four functions, and no row COPY/INSERT statements; it omits the custom auth trigger, which must be included separately.
- A `db diff --linked -f`-generated baseline resets locally but the subsequent linked diff re-emits the four functions (the normalized function bodies match, though source whitespace differs). Prefer the raw dump plus trigger for a no-drift baseline.
- Proposed repository adoption (completed in the next Stage 0 step): initialize/link CLI config, preserve all nine current SQL files byte-for-byte in an archive outside the active `supabase/migrations` folder, place only the baseline migration in the active folder, run local reset and linked diff, then register that single baseline version using `migration repair --linked --status applied <version>`. `migration repair` records history only, but is a hosted write.
- Stage 0 adoption (2026-10-01): initialized and linked the repo CLI, captured a fresh schema-only public dump, appended the custom `auth.users` trigger and five `supabase_realtime` publication memberships found by the linked diff, and created active baseline migration `20260930161439_authoritative_remote_schema_baseline.sql` using `supabase migration new`.
- Preserved all nine previous SQL files byte-for-byte under `supabase/migrations-archive/pre-baseline-manual-sql/`; SHA-256 hashes were checked before and after moving. Only the baseline remains active under `supabase/migrations/`. Updated `tests/gameRequestMigration.test.ts` to read the archived historical SQL and updated `DOCS.md`/roadmap references.
- Stage 0 verification: local `supabase db reset` passed; `supabase db diff --linked` reports no schema changes; `supabase migration repair 20260930161439 --status applied --linked` recorded the baseline version only; subsequent migration list shows `20260930161439` matched locally/remotely. No application schema SQL was pushed.
- App checks after the path update: 61 tests, lint, typecheck, and build pass. `git diff --check` still reports only the pre-existing blank line at `.gitignore:86`. `supabase db push --dry-run --linked --skip-vault` did not complete because the temporary `cli_login_postgres` role failed password authentication; migration list confirms no pending migrations. Stage 1 can begin after this Stage 0 exit; no two-account hosted verification was performed.


## Shared Playground Stage 1 Authorization Foundation

- Stage 1 completed locally on 2026-10-01. Migration `20260930173655_stage_1_relationship_authorization_foundation.sql` adds canonical couples/memberships, safe backfill, scoped RLS, transactional partner/request operations, and a revision-checked legal Tic-Tac-Toe move RPC.
- Stage 1 pgTAP passed 32 checks; `npm test` passed 67; lint, typecheck, and production build passed. Global diff-check still reports only the documented pre-existing `.gitignore:86` blank line.
- At the time of this entry, Stage 1 had not yet been applied to hosted Supabase; it was deployed on 2026-10-01 as hosted migration `20261001134451`. Hosted two-account verification remains pending.
- Stage-specific plan: `docs/superpowers/plans/2026-10-01-stage-1-authorization-foundation.md`. Stage 2 followed Stage 1 in a separate plan; Stage 3 is next.


## Shared Playground Stage 2 Progress

- Stage 2 implementation is complete within the user-approved scope: installed `vite-plugin-pwa` emits an install manifest and auto-updating static-shell service worker. Existing push handling is imported into that root worker; no Supabase runtime caching is configured.
- Added viewport-fit/keyboard metadata, safe-area and dynamic viewport rules, four-item nav layout, larger touch controls, and a white/pastel-blue theme with cool-gray hub panels. Auth screen now uses the same blue/white direction.
- Verification: 71 tests, lint, `npx tsc --noEmit`, and production build pass; HTTP preview serves the manifest and generated worker. `git diff --check` and cached diff checks pass on the current tree. PWA build emits two ineffective dynamic-import warnings.
- User explicitly deferred desktop screenshots/console and physical Galaxy S25 install/update/keyboard QA to later; these checks were not performed and remain unverified. Stage 2 is recorded complete with this exception; Stage 3 is next and remains unstarted.
- Stage 2 plan: `docs/superpowers/plans/2026-10-01-stage-2-mobile-pwa-ui.md`. No package was added. The preview command is available from the repo root (`C:\Users\User\Documents\1010\couple-app`), not `%TEMP%\couple-app-schema-audit`.

## Shared Playground Stage 3 Progress (2026-10-01)

- Implemented the shared `GameId` catalog and backward-compatible game request RPC defaults. Accepted hidden-answer sessions receive a five-minute database deadline; Tic-Tac-Toe sessions keep a null deadline and existing move RPC behavior.
- Added `game_submissions`, an authenticated RPC that derives the submitter from `auth.uid()`, disallows duplicates/invalid answers/expired or wrong-game sessions, and completes after both submit. PostgreSQL RLS reveals submissions only to the owner until both submit or `deadline_at <= now()`; the table joins `supabase_realtime` under the same SELECT policy.
- New local migration: `supabase/migrations/20261001134519_stage_3_shared_game_content_seam.sql` (hosted deployment version). Stage 0's nine archived migrations were not modified.
- Local DB reset/replay passed. pgTAP: 57/57 (33 authorization + 24 Stage 3). Local schema diff is empty; security advisors found no issues. Final app checks: 77 Node tests, lint, typecheck, and build passed; build retains the two existing ineffective dynamic-import warning groups.
- Full active-function audit: all local SECURITY DEFINER functions pin an empty search path; anon cannot execute any; `generate_profile_uid` is trigger-only; frontend RPC named arguments match SQL; and the Tic-Tac-Toe RPC now rejects non-Tic-Tac-Toe sessions at the database boundary without mutating them.
- Local app error root cause fixed: `vite.config.ts` pointed Vite at the parent workspace `.env`, which targets hosted Supabase even after local migrations were replayed. Vite now uses the app directory, with ignored `.env.development.local` values from `supabase status`; a fresh dev server's transformed Supabase client targets `127.0.0.1:54321`. Local migrations include the missing relationship RPCs.
- Pre-deployment linked-database audit confirmed only baseline `20260930161439` was applied. Stage 1 and Stage 3 were later deployed on 2026-10-01 as `20261001134451` and `20261001134519`; see the deployment record below. The pre-deployment baseline exposed four SECURITY DEFINER functions to anon and retained broad profile read/session update policies.
- Local two-account browser verification completed with Playwright on 2026-10-01: two isolated local accounts received a request without refresh, accepted into one shared Tic-Tac-Toe session, and synced moves in both directions. Duplicate send was disabled as “Request sent”; browser console had zero errors. Screenshots and steps: `docs/verification/remote-game/`. Temporary local accounts and sessions were removed; no hosted data was changed. Hosted two-account verification remains pending.
- Follow-up bug fix: request banner refreshes on Realtime subscription and browser focus, clears/updates stale requests after accept errors, Games requests refresh on subscription/focus, partner status refetches on subscription, Hub refetches sessions on subscription, and the remote board refetches on subscription/focus.
- Debug note: the accept RPC rejects requests unless the signed-in user is the recipient and the row is still pending and unexpired. Two-account Playwright verification passed against local Supabase; the reported rejection did not reproduce there. Since hosted Supabase has only the baseline migration applied, its exact failure remains unverified. Browser verification artifacts: `docs/verification/remote-game/`.

## Hosted Supabase deployment (2026-10-01)

- User authorized deploying the pending local migrations to hosted project `rophjogckmbkucowhhir`.
- Applied Stage 1 and Stage 3 in order with Supabase's hosted migration tool. Hosted versions are `20261001134451_stage_1_relationship_authorization_foundation` and `20261001134519_stage_3_shared_game_content_seam`; local migration filenames were updated to match the hosted history.
- Verified migration history contains baseline plus both stages; `couples`, `couple_members`, and `game_submissions` exist; `game_sessions.revision` exists; both game RPCs exist; `game_submissions` is in `supabase_realtime`; the safe legacy backfill created one couple with two members.
- No hosted two-account flow was run after deployment. Historical hosted SECURITY DEFINER/public policy concerns from the baseline have not been re-audited after deployment.

## Verification workflow learned

- An empty CUA browser inventory does not mean browser verification is unavailable. Check `npx playwright --version` and `npx playwright install --list`; use Playwright with installed Chromium when available.
- For two-account Realtime flows, start local Supabase and Vite, create two isolated Playwright contexts and disposable local users, establish their local relationship, and verify request arrival without reload, accept, shared state updates, console output, and screenshots. Clean up test users afterward.
- State clearly whether evidence is local or hosted. Local success cannot identify an un-reproduced hosted RPC failure.
- Better long-term fix: turn the temporary Playwright flow into a small repeatable local smoke test with deterministic setup and teardown, so this exact regression can be rerun without manual browser setup or hosted accounts.

## Game reliability debugging (2026-10-01)

- Reproduced the likely stale-board race in a regression test: a newer Realtime game state can arrive before an earlier refetch or move RPC response, which then used to overwrite the new state. The next move would send an old revision, fail as stale, and recover only after a refetch/relogin.
- Added `latestGameSession`, which keeps the higher server revision, and applied it to Realtime events, subscription/focus refetches, move RPC responses, and error recovery. Regression test failed before the helper existed and passes after the fix.
- Pre-deployment hosted audit: migration history contained only `20260930161439_authoritative_remote_schema_baseline`; hosted lacked `game_sessions.revision` and `submit_tic_tac_toe_move`. Stage 1 and Stage 3 were applied later; see the deployment record below.
- Hosted Realtime publication includes `game_sessions` and `game_requests`. Hosted aggregate inspection found one pending request whose expiry is already past, consistent with server-side expiration being enforced even when client countdown may be stale or clock-skewed. Exact cause of any shown countdown mismatch remains unproven.
- At the time of this entry, 78 Node tests, lint, typecheck, build, and diff check passed. A new full local two-account run was blocked because Docker Engine access was denied; the prior Playwright run documented above passed. Hosted deployment has since been authorized and completed; hosted two-account verification remains pending.

## Tic-Tac-Toe return navigation and migration readiness (2026-10-01)

- Fixed the remote-game “All games” button: it now clears `Hub`'s owned `activeSession`, allowing `Games` to leave the remote-session view and render its directory. Added a regression check proving the exit callback is passed through.
- Local `/?dev=pairing` browser simulation passed: Account 5 sent a request, Account 6 accepted, and both simulated players made alternating moves on the shared board. This uses the no-write developer harness, not authenticated Supabase accounts.
- Verification passed: 79 Node tests, lint, typecheck, production build, and `git diff --check`. Build retains the two existing ineffective dynamic-import warning groups.
- Pre-deployment hosted check: only baseline migration `20260930161439` was recorded; Stage 1 and Stage 3 were pending. The migrations were deployed after this check; see the hosted deployment record below. The Supabase CLI was unavailable and its `npx` bootstrap stalled; prior `db push --dry-run` was blocked by `cli_login_postgres` password authentication, so deployment proceeded through the authenticated Supabase migration tool. Hosted two-account verification remains pending.

## Local two-tab request failure (2026-10-01)

- Reproduced “Game request is no longer active” conditions in two real app tabs. Both were `http://localhost:5173`; they initially displayed UIDs 11 and 12, but refreshing the receiver changed it to UID 11, matching the sender. Supabase Auth persists sessions in origin-scoped `localStorage`, so tabs at one origin share one session; `Hub` had read `userId` only once and could retain a stale UID while RPCs used the shared current session.
- Added a Hub `onAuthStateChange` subscription that tracks identity changes, clears the old active game, and reloads the display UID. Regression test failed before implementation and passes after.
- Opened `http://127.0.0.1:5173` as an isolated second origin. It loads the same Vite app with separate auth storage, but is still at the sign-in form pending the user's manual authentication; do not claim the separate-origin authenticated request/accept/move flow was tested yet.
- Verification: 80 Node tests, lint, typecheck, production build, and `git diff --check` pass. Local UI reproduction confirmed same-origin UID drift; no hosted Supabase changes were made.

## Next session plan: repeatable local two-account smoke test

**Goal:** make the already-passing request/accept/shared-move Playwright check one command, fully local and safely disposable.

1. Read this memory and `DOCS.md`; inspect existing Playwright, Supabase local scripts, auth config, and screenshot artifacts before editing.
2. Add one small Playwright smoke test (reuse the installed dependency/browser) that starts against local Supabase + Vite, registers two unique local users, establishes their couple membership, and tests send, duplicate prevention, receiver arrival without reload, acceptance, then X/O synchronization both ways.
3. Ensure cleanup runs in `finally`: close contexts, remove test sessions/game requests/couples, and delete only the two users carrying this run's unique test-email prefix. Never target hosted Supabase; assert the configured API URL is localhost before creating users/data.
4. Capture request-sent, request-received, and shared-board screenshots under `docs/verification/remote-game/`; collect browser console/page errors and fail on any.
5. Add a package script only if the test cannot be run cleanly with the existing command setup. Document any dependency change in `DOCS.md`.
6. Verify repeatability by running the smoke test twice, then `npm test`, lint, typecheck, build, and `git diff --check`. Update `DOCS.md` and this memory with exact results.

**Acceptance:** one documented command proves the two-account local flow; second run passes with no leaked QA users/data. Hosted verification remains a separate task requiring deployment of the pending migrations and explicit live-account setup.

**Suggested next improvement after this:** resolve the hosted migration gap with a reviewed deployment plan, then run this same scenario with two hosted test accounts; do not mix migration deployment into the local smoke-test task.

## Shared Playground Stage 4 verified (2026-10-05)

- Implemented the four Stage 4 conversation games on the shared request/session flow, with internal metadata for Stages 4–8 only.
- Two isolated local accounts in Chrome and the Codex in-app browser completed Question Cards, Who’s More Likely, Lie Detector (both alternating rounds), and Describe Without Saying It (both alternating rounds). Paired answers stayed hidden until reveal; sender identity and request receipt were checked.
- Browser testing found and fixed two issues: completed Lie Detector/Describe history did not show round results, and the Describe timer began before the clue giver had seen the word. The timer now starts only after the clue giver views the word and explicitly starts the turn; expired first turns leave the next timer unstarted.
- Verified a 384×832 CSS-pixel viewport with no horizontal overflow and no console errors after fresh reloads. Browser screenshots were captured during the task.
- Verification passed: 88 Node tests, 103 local pgTAP checks, lint, TypeScript, production build, and `git diff --check`.
- Created and removed two disposable local auth accounts and their temporary couple/game data. No hosted Stage 4 migration was deployed.

## Shared Playground Stage 5 verified (2026-10-05)

- Added Memory Match, Rock Paper Scissors, and Word Chain as local pass-and-play games. Bored Mode filters by time and partner availability, prefers games not played in the prior seven days, falls back to a recent game when that is the only fit, and shows a reason for each suggestion.
- Recency is saved in device-local storage per signed-in user and updates when a shared game session is entered; no shared schema or dependency was added.
- Browser inspection at 384×832 CSS pixels confirmed Bored Mode and Memory Match render without horizontal overflow; the preview console reported no errors. The temporary preview app skipped Supabase authentication, which was unavailable locally because the Supabase/Docker stack was not running. These new games are local-only, so authenticated two-account verification was not applicable. No hosted changes were made.
- Verification: 99 Node tests, lint, `npx tsc --noEmit`, production build, and `git diff --check` passed. Build retains existing large-chunk and ineffective dynamic-import warnings.
- Stage 5 plan: `docs/superpowers/plans/2026-10-05-stage-5-tiny-games.md`.

## Shared Playground Stages 6 and 7 in progress (2026-10-05)

- Implemented the Stage 6 Us tab, timezone-aware daily question and hidden paired answers, couple-shared bucket list and inside jokes, and curated activity timeline with game/list triggers.
- Implemented the Stage 7 Draw Together catalog/routing, configurable timed canvas, keyboard and pointer drawing, private reference preview before the timer starts, private image submission and reveal, plus local SQL/RLS/Storage policies and database tests.
- Applied migrations `20261005180000`, `20261005183000`, and the Stage 7 request-validator fix `20261005190000` to local Supabase only. The fix allows `draw-together` through the existing request RPC validator. No hosted migration was deployed.
- Created two isolated local browser accounts and paired them through the UI. Stage 6 daily answers remained private until both partners answered; bucket item create/complete, inside-joke creation, and timeline pin/hide updates synced between the two accounts. Stage 7 request, partner acceptance, 1-minute drawing round, private first submission, second submission, and joint reveal passed in two browser contexts. Pointer drawing was visibly rendered. Screenshots were captured and inspected during these flows.
- The first Stage 7 request exposed the validator bug above. An initial 15-second round expired before the second account finished drawing; a repeat using the 1-minute preset completed successfully. The reference-image upload and cross-account Storage access were not verified because the available browser automation could not populate the native file chooser. Touchscreen interaction, exact mobile viewport sizing, and browser console inspection were also not completed.
- Verification passed after the fix: 111 Node tests, lint, `npx tsc --noEmit`, production build, and `git diff --check`. Build reports existing large-chunk and ineffective dynamic-import warnings.
- Local pgTAP passed: 150 assertions across five files, including the new Stage 6 and Stage 7 authorization suites. Afterward, read-only verification confirmed both QA auth accounts and all three Stage 6/7 migration records remained present. The local database service was authorized and used; hosted Supabase was untouched.
- Read-only schema inspection confirmed couple-scoped RLS, hidden-answer/submission policies, and the private `couple-drawings` bucket with its 5 MiB and JPEG/PNG/WebP restrictions. Two QA accounts and test data remain locally. Stage 6/7 acceptance remains incomplete until reference-image Storage behavior, touchscreen interaction, exact mobile viewport, and browser-console inspection are verified. Do not mark the stages complete yet.
- Follow-up verification (2026-10-06): added friend-capable Memory Match, Rock Paper Scissors, and Word Chain with solo/bot/people modes; removed Bored Mode. Added private profile-avatar upload and the supplied drawing subject/topic catalog with custom prompts. Two local authenticated browsers completed partner requests, Memory Match shared reveal, RPS private-choice/reveal, Word Chain turn handoff, custom and preset drawing prompts, hidden first drawing, and joint reveal. The avatar PNG preview/upload/save passed through the Codex in-app browser. Browser screenshots were inspected at 384×832 CSS pixels; keyboard drawing was verified. A visible “All games” regression was fixed so an exited active session stays dismissed, and a completed current session remains available until exit.
- Final verification: 125 Node tests, lint, `npx tsc --noEmit`, production build, 207 local pgTAP checks, and `git diff --check` pass. Production build still reports the existing >500 kB chunk and ineffective dynamic-import warnings. The new migrations `20261006073004_friend_tiny_game_sessions.sql`, `20261006085440_private_profile_avatars.sql`, and `20261006090541_drawing_round_prompts.sql` were applied only to local Supabase. The two disposable local auth accounts and their test data were removed by the authorized local reset. Hosted Supabase remains untouched.
- Limits: a React HMR dependency-array warning was logged in both open tabs while changing Hub code; it was from hot replacement, and final page reloads produced no new warning. Chrome’s extension file chooser refused file access until “Allow access to file URLs” is enabled, so the avatar save was verified in the in-app browser with one PNG sample. JPEG/WebP/size-boundary browser uploads and physical Android touch/reference-image flows were not checked. Stage 7’s on-device acceptance remains open.
