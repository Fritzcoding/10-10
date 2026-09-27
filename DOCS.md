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
- Apply Supabase migrations `202609240002_add_direct_messages.sql` and `202609240003_add_friend_discovery_policies.sql` before testing search, requests, or chat against the deployed database.
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
