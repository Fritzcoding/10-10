# Project Progress

## Current Dependencies

- Playwright (`devDependency`): browser automation for local end-to-end flow verification.

## Stage 4: Core Hub Interface

- [x] 4.1 - Hub Layout & Background
- [x] 4.2 - Partner Status Badge
- [x] 4.3 - Bottom Navigation Bar

### Stage 4 commit messages

- 4.1: `Stage 4.1: Add Hub layout and background`
- 4.2: `Stage 4.2: Add partner status badge`
- 4.3: `Stage 4.3: Add Hub bottom navigation`

## Stage 5: Social & Partner Management

- [x] 5.1 - Friend Search & Request System
- [x] 5.2 - Partner Request System
- [x] 5.3 - Settings Screen
- [x] 5.4 - UID Discovery & Request Management

### Stage 5 commit messages

- 5.1: `Stage 5.1: Add friend search and requests`
- 5.2: `Stage 5.2: Add partner request management`
- 5.3: `Stage 5.3: Add user settings and logout`
- 5.4: `Stage 5.4: Improve UID discovery and request management`

### Friends bug-fix verification

- Numeric-only searches query `profiles.display_uid`; email searches query `profiles.email` without passing email text to the numeric column.
- Profile loading and friend searches always clear their loading state in `finally` blocks.
- Missing profile UIDs display as `UID: #--`.
- Commit: `fix: handle numeric input check and loading states in friends tab`
- UID search results now remain visible after a friend request and expose a direct realtime chat panel backed by `direct_messages`.
- The current Supabase schema is captured in `supabase/migrations/20260930161439_authoritative_remote_schema_baseline.sql`. Historical manual SQL files are preserved under `supabase/migrations-archive/pre-baseline-manual-sql/`; do not replay them as new migrations.
- Search now reports a visible readiness error instead of silently returning when the authenticated profile is not initialized; the authenticated user ID is stored before secondary friends/request refreshes.

## Stage 6: Realtime Multiplayer Games

- [x] 6.1 - Game Directory Grid
- [x] 6.2 - Tic-Tac-Toe Game Board UI
- [x] 6.3 - Supabase Realtime Synchronization

### Stage 6 commit messages

- 6.1: `Stage 6.1: Add games directory grid`
- 6.2: `Stage 6.2: Add Tic-Tac-Toe game board UI`
- 6.3: `Stage 6.3: Add Supabase realtime game synchronization`

## Shared Playground Stage 5: Tiny games and play modes

- [x] Memory Match, Rock Paper Scissors, and Word Chain support solo, bot, and partner/friend play; partner is first in the people picker.
- [x] Bored Mode and its device-local recommendation history were removed.
- [x] Friend/partner sessions use server-validated RPCs, private memory decks and RPS choices, revision checks, and couple/friend authorization.
- [x] Local two-account browser checks covered partner requests, Memory Match shared reveals, hidden RPS choice and reveal, Word Chain turn handoff, solo play, bot turns, and partner-first ordering. Mobile screenshots were inspected at 384×832 CSS pixels.
- [x] Regression fixes keep a completed game visible until exit and prevent an exited active session from reopening over the directory.
- [x] Verification: 125 Node tests, lint, `npx tsc --noEmit`, production build, `npx supabase test db --local` (207 checks), and `git diff --check` pass.
- [x] No new package was installed. Migrations are local only; hosted Supabase was not changed. Temporary browser users/data were removed by resetting the authorized local database after verification.

Stage 5 follow-up commit message: `Stage 5: Connect tiny games, add profile avatars and drawing prompts`

## Profile avatars and drawing prompts follow-up

- [x] Profile accepts private JPEG/PNG/WebP avatars up to 5 MiB and preserves legacy HTTP(S) avatar URLs. Browser verification selected and saved a local PNG; pgTAP covers bucket privacy, ownership, and relationship reads.
- [x] Draw Together includes the supplied 150 subject/topic pairs, custom subject/topic entry, shared saved prompts, and database length/authorization checks.
- [x] Two-account browser verification confirmed both preset and custom prompts reach the partner, and drawing submissions remain private until both accounts submit. No reference image was needed for the prompt flow.
- [x] Final verification: 125 Node tests, lint, TypeScript, build, 207 local pgTAP checks, and diff check pass. The build retains existing large-chunk and ineffective dynamic-import warnings.
- A transient React Fast Refresh warning appeared in both open browser tabs when the Hub effect dependency list changed during implementation. Final page reloads produced no new warning.
- The Chrome extension file chooser requires enabling “Allow access to file URLs”; avatar selection and save succeeded in the Codex in-app browser. Physical Android touchscreen testing and browser upload of all avatar formats/size boundaries remain unverified.

- [x] 2.2 - Audio Player & Unmute Logic
- [x] 3.1 - Auth Modal UI
- [x] 3.2 - Supabase Authentication Integration

- [x] 1.2 — Initial app foundation and database/client integration
- [x] 2.1 — Birthday Message Scroll UI
## Remote multiplayer games

The current baseline includes the remote game tables and policies. Historical SQL is retained in `supabase/migrations-archive/pre-baseline-manual-sql/` for reference and is not part of fresh database resets. Requests expire at exactly 60 seconds and the acceptance RPC enforces that deadline server-side. Realtime Presence determines online/offline grouping; persisted requests and notifications remain authoritative after reconnect.

The current baseline includes this expiry behavior and enables realtime profile updates used by pairing status.

The preserved historical migration `202609300002_fix_game_request_recipient_reference.sql` records the unambiguous `target_recipient_id` RPC parameter used by the current baseline.

The preserved historical migration `202609300003_fix_accept_game_request.sql` records the unambiguous `target_request_id` parameter used by the current baseline.

Request banner now resyncs on Realtime subscription and browser focus, and refreshes the request after a rejected accept so stale cards are removed or updated. Server acceptance still enforces recipient, pending status, and expiry; verify hosted behavior with two accounts after the relevant SQL is deployed.

Local two-account developer verification is available at `/?dev=pairing`. It simulates UID 5 and UID 6 without Supabase writes, including request expiry, acceptance, and shared board moves.

Optional push delivery uses `supabase/functions/send-game-push`. Store VAPID public/private keys only as Supabase Function secrets. The function is best-effort and must not replace the in-app banner.

## Required browser and screenshot verification

After changing request, friend, game, or other user-facing flows, verify the result in a browser and capture screenshots of the important states. Do not rely only on unit tests or a successful build.

For game requests, use two authenticated browser sessions/accounts and verify:

1. The sender sees the selected friend’s name, online/offline status, and a visible “Request sent” state.
2. Sending the same request again shows the existing pending request instead of creating a duplicate or showing an unexplained database error.
3. The receiver sees the sender’s name, game name, expiry, and Accept/Decline controls in the persistent request banner.
4. Accepting the request moves both accounts directly into the same Tic-Tac-Toe game and both browsers show the same board after a move.
5. Capture screenshots for the sent state, received state, accepted/shared-game state, and duplicate-request state.

Web verification checklist: run `npm run dev`, open the app in a browser, inspect the visible UI after each action, check browser console errors, and record the tested accounts/steps alongside the screenshots before considering the change complete.

Latest automated verification after Stage 1: 67 Node tests, 32 local Supabase pgTAP checks, lint, typecheck, and build pass. `git diff --check` reports the known pre-existing `.gitignore:86` extra blank line. Stage 1 remains unapplied on hosted Supabase; no two-account hosted test was performed.


## Shared Playground Stage 1: Relationship and Authorization Foundation

- [x] Canonical two-member couple membership and safe legacy backfill
- [x] Couple-scoped profile, chat, request, and game-session authorization
- [x] Transactional pairing and revision-checked Tic-Tac-Toe move RPC
- [x] Retire the fixed public game broadcast channel
- [x] Local verification: 32 Supabase pgTAP checks, 67 Node tests, lint, typecheck, and build pass
- Hosted migrations are applied; the partner backfill created one couple with two members. Hosted two-account verification remains pending. `git diff --check` flags the pre-existing `.gitignore:86` blank line only.

Stage 1 commit message: `Stage 1: Add relationship authorization foundation`

## Shared Playground Stage 2: Mobile/PWA Baseline and UI

- [x] Four-column responsive navigation, safe areas, dynamic viewport/keyboard support, and touch behavior
- [x] Existing `vite-plugin-pwa` configured with manifest, install icons, app-shell precache, and update handling; retain push notifications without caching Supabase data
- [x] Clean white and pastel blue UI while preserving the existing gray panel treatment
- [x] Browser screenshots and physical Android install/update/keyboard checks deferred by user for later device QA; these checks were not performed

Stage 2 commit message: `Stage 2: Add mobile PWA baseline and pastel UI`

Stage 2 is complete within the user-approved scope. 71 Node tests, 32 local pgTAP checks, lint, typecheck, build, HTTP preview, and diff checks pass. Desktop browser/screenshot and Galaxy S25 install/update/keyboard QA are explicitly deferred by the user and remain unverified; debug later if device issues appear. Stage 3 implementation progress is recorded below.

## Shared Playground Stage 3: Shared Game and Hidden Answer Lifecycle

- [x] Shared game IDs/catalog and backward-compatible Tic-Tac-Toe request/session types
- [x] Server deadline and PostgreSQL-enforced hidden submission lifecycle with owner-only reads until both submit or the deadline
  - [x] Local verification: 77 Node tests, 57 pgTAP checks, typecheck, lint, build, empty local schema diff, and security advisors clean
  - [x] Function audit: local RPC argument names match client payloads; all SECURITY DEFINER functions pin an empty search path; no public SECURITY DEFINER function is callable by anon; Tic-Tac-Toe moves reject other game types in PostgreSQL
  - [x] Local app routing: Vite had `envDir: '../'` and loaded the parent workspace's hosted URL. It now reads app-local env files; ignored `.env.development.local` points dev to local Supabase.
  - [x] Hosted Stage 1 and Stage 3 migrations applied and verified. Migration history and the couples, game submissions, Tic-Tac-Toe move RPC, hidden-answer RPC, and Realtime publication entries are present. One legacy partner pair was backfilled. Hosted two-account verification remains pending.
- [x] Local two-account Playwright verification: receiver got the request without refresh, acceptance opened the shared session, and X/O moves synced both ways with zero console errors; screenshots and steps are in `docs/verification/remote-game/`

Hosted migrations: `20261001134451_stage_1_relationship_authorization_foundation.sql` and `20261001134519_stage_3_shared_game_content_seam.sql`. They were applied through the Supabase migration tool and local filenames now match the hosted versions. Hosted two-account verification remains pending.

Debug finding (2026-10-01, before deployment): current client move submission calls `submit_tic_tac_toe_move` with a session revision. The pre-deployment hosted baseline lacked that RPC and `game_sessions.revision`, while the old broad participant UPDATE policy remained. Stage 1 and Stage 3 are now deployed; hosted two-account move behavior remains unverified.

## Shared Playground Stage 4: Conversation Games

- [x] Added Question Cards, Who’s More Likely, Lie Detector, and Describe Without Saying It to the shared game catalog and existing request/session/Hub routing.
- [x] Added original categorized prompts, provenance, couple-authored questions, private submissions, alternating creator/guesser rounds, and server-enforced 60-second Describe timing.
- [x] Added internal roadmap metadata for Stages 4–8 without future screens, handlers, or data models.
- [x] Local two-account browser verification used separate Chrome and in-app browser sessions. All four games completed; paired answers remained private until reveal, and Lie Detector/Describe roles alternated. Sender identity, active requests, and the Describe timer were checked.
- [x] Mobile-width screenshot review at 384×832 CSS pixels found no horizontal overflow; fresh browser reloads reported no console errors. Screenshots were captured during this task.
- [x] Verification: 88 Node tests, 103 local pgTAP checks, lint, `npx tsc --noEmit`, build, and `git diff --check` pass.
- Stage 4 migration remains local. It was not deployed to hosted Supabase.

Stage 4 commit message: `Stage 4: Add private conversation games`

## Shared Playground Stage 7: Drawing and Images

- [x] Partner-requested Draw Together flow with timed rounds, shared optional reference image, private drawing submissions, and joint reveal.
- [x] Local database authorization suite: 28/28 drawing assertions passed. Two-account mobile browser verification confirmed a PNG reference upload and partner access, touch-event drawing, hidden first submission, and reveal after both submit; browser console had no errors.
- [x] Screenshots were captured and inspected at 384×832 CSS pixels in `docs/verification/stage-7/`.
- Android emulator Chrome and a physical Galaxy device were not verified. The app flow was exercised with mobile browser emulation; do not treat that as physical-device verification.
- Stage 7 migration remains local; no hosted migration was deployed.

Stage 7 commit message: `Stage 7: Add private drawing and image rounds`

## Shared Playground Stage 8: Key Dates and Countdowns

- [x] Added couple-scoped milestones for anniversaries, birthdays, trips, visits, and other dates, with annual recurrence, categories, edits, removal, a featured countdown, and in-app 7-day reminders.
- [x] Annual date and leap-day recurrence, date validation, countdown day math, and upcoming ordering have pure tests.
- [x] Local pgTAP authorization suite: 15/15 assertions passed, including couple isolation, invalid values, featured countdown RPC permissions, and private Realtime policy presence.
- [x] Two local authenticated browser accounts created, edited, and removed a milestone; private couple Realtime synced the changes. Mobile layout at 384×832 was inspected, and the browser console had no errors. Screenshot: `docs/verification/stage-8/countdown-mobile.png`.
- [x] Verification: 130 Node tests, lint, TypeScript, production build, and `git diff --check` pass. Build retains existing chunk-size and ineffective dynamic-import warnings.
- Stage 8 migration remains local; no hosted migration was deployed.

Stage 8 commit message: `Stage 8: Add shared key dates and countdowns`

## Shared Playground Stage 9: Wishlists

- [x] Extended the existing couple bucket list with date, place, food, gift, and trip categories, notes, optional safe HTTP(S) links, saved and completed states, and category filtering.
- [x] Local pgTAP suite passed 12 assertions for column constraints, couple sharing/isolation, category validation, and unsafe link rejection.
- [x] Two local accounts added, edited, saved, completed, and removed wishlist items; changes appeared in the partner view. Inspected 384×832 mobile screenshot: `docs/verification/stage-9/wishlist-mobile.png`; browser console was clear.
- [x] Verification: 133 Node tests, lint, TypeScript, production build, and `git diff --check` pass. Build retains existing chunk-size and ineffective dynamic-import warnings.
- Stage 9 migration is local only; no hosted migration was deployed.

Stage 9 commit message: `Stage 9: Expand shared bucket list into wishlists`

## Shared Playground Stage 10: Shared Calendar and Date Planning

- [x] Added a couple-scoped in-app month calendar and upcoming agenda, with all-day dates, timed events, selected timezones, notes, edit/remove, and optional milestone/wishlist references.
- [x] Local pgTAP suite passed 14 assertions for RLS/couple isolation, partner reads/edits, all-day/timed shape, timezone validation, same-couple references, and private broadcast authorization.
- [x] Two separate Chrome instances signed in as local couple members. All-day create, timed event create in Asia/Taipei, edit, agenda view, and deletion synced in both directions; mobile viewport was 384×832 with zero browser-console errors. Screenshots: `docs/verification/stage-10/calendar-mobile.png` and `docs/verification/stage-10/agenda-mobile.png`.
- [x] Verification: 137 Node tests, lint, TypeScript, production build, and `git diff --check` pass. Build retains existing chunk-size and ineffective dynamic-import warnings.
- Stage 10 migration is local only; no hosted migration was deployed.

Stage 10 commit message: `Stage 10: Add shared calendar and date planning`

## Shared Playground Stage 11: Photo Memories

- [x] Added couple-scoped photo metadata, private `couple-memories` Storage, 5 MiB JPEG/PNG/WebP limits, Storage/row RLS, and same-couple timeline links. Local migration replay and 16 photo-memory pgTAP checks passed; the full local pgTAP suite passed 264 checks.
- [x] Added pure upload/date validation and shared album UI for authenticated display, captions, dates, timeline links, edits, deletion, and “On this day”.
- [x] Two local accounts verified the flow: UID #158 uploaded the photo; paired UID #157 loaded it in the album and “On this day”; UID #157 removed it and the album showed 0 photos with the empty state. Console errors were empty. Mobile layout was captured and visually inspected at 384×832 in the browser session.
- [x] `npm test` passed 140 tests; lint, TypeScript, production build, 264 local pgTAP checks, and `git diff --check` passed. Existing chunk-size and ineffective dynamic-import build warnings remain.
- Migration remains local; no hosted Supabase changes. No dependencies added.

Stage 11 commit message: `Stage 11: Add private photo memories`

## Shared Playground Stage 12: Love Notes and Voice Memos (complete)

- [x] Added couple-scoped love notes, private voice-memo Storage policies (5 MiB cap), duration constraints (60 seconds), Realtime, and recording/playback UI. Local migration replay and 17 Stage 12 pgTAP checks passed; full local database suite passed 281 checks.
- [x] Pure validation tests cover trimmed 2,000-character notes and supported audio type, size, and duration bounds. Full app checks passed: 143 tests, lint, TypeScript, production build, and `git diff --check`.
- [x] Two local authenticated browser sessions verified note creation and Realtime sync with author identity; the 384×832 view was inspected with no horizontal overflow and no browser-console errors.
- [x] In a second authenticated browser session (UID #5), the partner saw the note as “Your partner” and played the private memo through to 0:03; the player used the authenticated blob download and the browser console had no errors.
- [x] Stage 12 passed: 143 tests, lint, TypeScript, build, 281 local pgTAP checks, security advisors, and diff-check. The 384×832 mobile layout was inspected. No hosted migration was deployed; no dependencies were added.

Stage 12 commit message: `Stage 12: Add love notes and voice memos`

## Shared Playground Stage 13: Mood Check-ins and Rituals

- [x] Added private-by-default mood check-ins, explicit couple sharing, author deletion, weekly either/both rituals, optional in-app reminders, and couple-private Realtime refresh.
- [x] Local database suite passed 303 checks, including 22 mood/ritual assertions; security advisors found no issues.
- [x] Two local authenticated browser sessions verified private mood isolation, shared mood Realtime visibility, and both-partner ritual check-ins. The 384×832 screenshot was inspected and both browser consoles were clear.
- [x] Verification: 148 Node tests, lint, TypeScript, production build, and `git diff --check` passed. Existing large-chunk and ineffective dynamic-import build warnings remain.
- Migration is local only; no hosted Supabase changes or new dependencies.

Stage 13 commit message: `Stage 13: Add mood check-ins and rituals`

## Shared Playground Stage 14: Temporary Live Location

- [x] Added opt-in, foreground-only location sharing for 15, 30, or 60 minutes. Server RPCs own expiry and coordinates; RLS hides expired rows immediately, stop deletes immediately, and local/Supabase `pg_cron` physically purges expired rows every minute.
- [x] Local pgTAP passed 27 Stage 14 assertions for member start/update/stop, bounded durations, coordinate validation, expiry, physical purge, partner access, unrelated-account isolation, and private Realtime refresh. Full database suite passed 330 checks; security advisors found no issues.
- [x] Two authenticated browser sessions displayed a synthetic coordinate to the partner; the synthetic row was then removed. The 384×832 view was screenshot-inspected with no horizontal overflow and both browser consoles were clear.
- [x] Verification: 152 Node tests, lint, TypeScript, production build, and `git diff --check` passed. Existing chunk-size and ineffective dynamic-import warnings remain. No hosted migration was deployed and no dependency was added.
- Actual browser location permission and GPS were not requested or tested; the user-facing permission-denial/error path is covered by pure tests. The app requests permission only after the user presses Start.

Stage 14 commit message: `Stage 14: Add temporary live location`

## Shared Playground Stage 15: Shared Love Board

- [x] Added a couple-scoped vector board with independent stroke inserts, bounded normalized coordinates, keyboard drawing, pointer/touch handlers, author-only undo, and confirmed shared clear. Private Realtime events carry only a refresh signal; local migration only.
- [x] Stage pgTAP passed 34 assertions; full local database suite passed 364 checks, including member authorization, independent strokes, undo isolation, generation changes, and stale-write rejection.
- [x] Two authenticated browser accounts drew independently and received each other's strokes in Realtime. Undo removed only its author's stroke; the shared board was cleared after testing. Mobile screenshot inspected at 384×832; browser console checks were clear.
- [x] Verification: 156 Node tests, lint, TypeScript, production build, and `git diff --check` passed. Existing chunk-size and ineffective dynamic-import warnings remain. No dependency or hosted migration.
- Pointer/touch drawing was not physically exercised; keyboard drawing and pointer coordinate normalization were verified. Physical Android verification remains for the native stages.

Stage 15 commit message: `Stage 15: Add shared Love Board`

## Shared Playground Stage 4: Conversation Games

- [x] Added Question Cards, Who’s More Likely, Lie Detector, and Describe Without Saying It to the shared game catalog and existing request/session/Hub routing.
- [x] Added original categorized prompts, provenance, couple-authored questions, private submissions, alternating creator/guesser rounds, and server-enforced 60-second Describe timing.
- [x] Added internal roadmap metadata for Stages 4–8 without future screens, handlers, or data models.
- [x] Local two-account browser verification used separate Chrome and in-app browser sessions. All four games completed; paired answers remained private until reveal, and Lie Detector/Describe roles alternated. Sender identity, active requests, and the Describe timer were checked.
- [x] Mobile-width screenshot review at 384×832 CSS pixels found no horizontal overflow; fresh browser reloads reported no console errors. Screenshots were captured during this task.
- [x] Verification: 88 Node tests, 103 local pgTAP checks, lint, `npx tsc --noEmit`, build, and `git diff --check` pass.
- Stage 4 migration remains local. It was not deployed to hosted Supabase.

Stage 4 commit message: `Stage 4: Add private conversation games`
