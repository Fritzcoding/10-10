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
- The Stage 1 migration is not applied to hosted Supabase. No two-account hosted test was performed.
- Stage-specific plan: `docs/superpowers/plans/2026-10-01-stage-1-authorization-foundation.md`. Stage 2 followed Stage 1 in a separate plan; Stage 3 is next.


## Shared Playground Stage 2 Progress

- Stage 2 implementation is complete within the user-approved scope: installed `vite-plugin-pwa` emits an install manifest and auto-updating static-shell service worker. Existing push handling is imported into that root worker; no Supabase runtime caching is configured.
- Added viewport-fit/keyboard metadata, safe-area and dynamic viewport rules, four-item nav layout, larger touch controls, and a white/pastel-blue theme with cool-gray hub panels. Auth screen now uses the same blue/white direction.
- Verification: 71 tests, lint, `npx tsc --noEmit`, and production build pass; HTTP preview serves the manifest and generated worker. `git diff --check` and cached diff checks pass on the current tree. PWA build emits two ineffective dynamic-import warnings.
- User explicitly deferred desktop screenshots/console and physical Galaxy S25 install/update/keyboard QA to later; these checks were not performed and remain unverified. Stage 2 is recorded complete with this exception; Stage 3 is next and remains unstarted.
- Stage 2 plan: `docs/superpowers/plans/2026-10-01-stage-2-mobile-pwa-ui.md`. No package was added. The preview command is available from the repo root (`C:\Users\User\Documents\1010\couple-app`), not `%TEMP%\couple-app-schema-audit`.
