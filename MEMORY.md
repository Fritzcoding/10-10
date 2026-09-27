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
