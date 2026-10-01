# Project Progress

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
- Hosted migration is not applied; no two-account hosted verification was performed. `git diff --check` flags the pre-existing `.gitignore:86` blank line only.

Stage 1 commit message: `Stage 1: Add relationship authorization foundation`

## Shared Playground Stage 2: Mobile/PWA Baseline and UI

- [x] Four-column responsive navigation, safe areas, dynamic viewport/keyboard support, and touch behavior
- [x] Existing `vite-plugin-pwa` configured with manifest, install icons, app-shell precache, and update handling; retain push notifications without caching Supabase data
- [x] Clean white and pastel blue UI while preserving the existing gray panel treatment
- [x] Browser screenshots and physical Android install/update/keyboard checks deferred by user for later device QA; these checks were not performed

Stage 2 commit message: `Stage 2: Add mobile PWA baseline and pastel UI`

Stage 2 is complete within the user-approved scope. 71 Node tests, 32 local pgTAP checks, lint, typecheck, build, HTTP preview, and diff checks pass. Desktop browser/screenshot and Galaxy S25 install/update/keyboard QA are explicitly deferred by the user and remain unverified; debug later if device issues appear. Stage 3 (shared game/content seam) is next and has not started.
