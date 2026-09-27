# Remote Multiplayer Games Design

## Goal

Let two confirmed friends play the available game, Tic-Tac-Toe, from separate internet-connected devices. Selecting a game presents a choice between a local bot match and a remote friend match. Friend matches use the existing Supabase project as the shared backend; they do not depend on the devices being nearby or on a LAN.

## Scope and success criteria

- Selecting Tic-Tac-Toe opens a mode chooser with “Play against Bot” and “Play with a Friend”.
- Bot mode is fully local and uses a simple delayed legal-move bot.
- Friend mode lists confirmed friends, grouped into Online and Offline, with Online first.
- Online presence is shared through Supabase Realtime Presence and filtered to confirmed friends.
- A friend-game request is persisted in Supabase and delivered in realtime when the recipient is online.
- Every pending request is active for 60 seconds; after that it is treated as cancelled due to inactivity and cannot be accepted.
- Offline recipients receive a persisted in-app notification and, when browser push is configured and permission is granted, a browser/OS notification.
- Accepting a request creates a remote Tic-Tac-Toe session. Both devices read and write the same session state with server-enforced turn ownership.
- A recipient can accept or decline a pending request. Requests and sessions can be refreshed after reconnecting.
- Existing friend, chat, partner, authentication, and bot-free game behavior remain intact.

## User flow

1. The user opens Games and selects Tic-Tac-Toe.
2. The mode chooser offers Bot or Friend.
3. Bot opens the existing board with a local opponent. The bot selects a legal move after a short delay and never writes game data to Supabase.
4. Friend opens a picker with confirmed friends. Friends currently present on the shared Realtime Presence channel appear in the Online group; the rest appear in Offline.
5. Selecting a friend creates one pending game request. Duplicate pending requests for the same requester, recipient, and game are rejected in the UI and by a database uniqueness rule.
6. The recipient sees an unread request in the persistent top section of the app, regardless of whether they are viewing Games, Friends, or Settings. If the recipient is online, Realtime delivers it immediately; if offline, the persisted notification is loaded on their next visit. Browser push is an additional delivery channel, not the source of truth.
7. The request remains actionable for 60 seconds. A scheduled/conditional expiry path marks it `expired` after the deadline, and both users see the cancelled state through Realtime or after refresh.
8. Accepting creates a session and both users enter the same remote board. Declining marks the request declined. The requester sees the updated state in realtime or after refresh.

## Data model

Add a migration with these tables and policies:

### `game_requests`

- `id uuid primary key`
- `requester_id uuid references profiles(id)`
- `recipient_id uuid references profiles(id)`
- `game_type text` constrained to `tic-tac-toe`
- `status text` constrained to `pending`, `accepted`, `declined`, or `expired`
- `expires_at timestamptz` set to `created_at + interval '60 seconds'`
- `created_at`, `updated_at` timestamps
- requester/recipient must differ
- unique pending request per ordered requester, recipient, and game type

Authenticated users may read requests where they are requester or recipient, create requests only as requester, and update requests only as recipient for accept/decline. Acceptance is valid only while `status = 'pending'` and `expires_at > now()`. Realtime publication includes request changes. Expiry is enforced by the client refresh path and by the acceptance/update guard so an inactive request cannot be accepted after 60 seconds.

### `game_sessions`

- `id uuid primary key`
- `game_type text` constrained to `tic-tac-toe`
- `player_x_id uuid references profiles(id)`
- `player_o_id uuid references profiles(id)`
- `board jsonb` containing nine nullable marks
- `turn text` constrained to `X` or `O`
- `status text` constrained to `active`, `won`, `draw`, or `abandoned`
- `winner text` nullable
- `created_at`, `updated_at` timestamps

Only the two players may read a session. Client writes must be limited by RLS to the participating users; the move helper validates board positions and turn ownership before updates. Realtime publication includes session changes. If database-side turn validation cannot be expressed safely in the initial migration, updates go through a narrow RPC function that performs the validation atomically.

### `notifications`

- `id uuid primary key`
- `user_id uuid references profiles(id)`
- `kind text` constrained to `game_request`
- `game_request_id uuid references game_requests(id)`
- `title`, `body` text
- `read_at` nullable timestamp
- `created_at` timestamp

Users may read and mark their own notifications as read. Request creation creates the recipient notification transactionally or through a database trigger. Realtime publication includes notification inserts and updates.

### `push_subscriptions`

Store the browser push endpoint and keys per authenticated user and device. Users may create, update, and delete only their own subscription rows. A Supabase Edge Function sends Web Push notifications using VAPID secrets; without configured VAPID secrets, the in-app notification path still works.

## Client architecture

- `Hub` owns the persistent top request/notification banner so it remains visible above Games, Friends, and Settings; `Games` owns the game directory, mode chooser, friend picker, and selected session.
- A small `gameRequests` library owns request status labels, duplicate detection, and request presentation helpers.
- A `gamePresence` hook subscribes to one Realtime Presence channel, tracks the current user, and exposes online user IDs. It does not treat a stale database row as online.
- A `gameSessions` library wraps session creation, move submission, and board-state validation.
- `TicTacToe` accepts a local/remote mode and callbacks for remote moves while retaining the existing pure game helpers.
- Notification loading and realtime subscriptions are scoped to the authenticated user and cleaned up when Games unmounts.
- The top banner shows pending, non-expired incoming game requests first, displays remaining time, and removes or labels a request as cancelled when the 60-second deadline passes.
- Browser notifications are requested only after a user gesture and only for incoming game requests. Push subscription is best-effort and never blocks the in-app flow.

## Error handling and reconnect behavior

- Missing migrations produce actionable inline messages naming the required migration.
- Realtime disconnects show a non-blocking reconnect state; the app reloads pending requests, notifications, and the active session when the channel reconnects.
- A stale or already-accepted request cannot create a second session.
- A request at or beyond its 60-second `expires_at` deadline is cancelled and cannot be accepted, even if an old client still displays it.
- A move against an occupied square, wrong turn, completed session, or non-player is rejected without mutating local state.
- If browser notification permission is denied or Push API is unavailable, persisted in-app notifications remain the fallback.

## Verification

- Unit tests cover bot legal moves, request deduplication, 60-second expiry and state transitions, online/offline grouping, unread notification handling, top-banner visibility state, and remote move validation.
- Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- Manually verify with two authenticated browsers on different networks: presence grouping, request delivery, accept/decline, synchronized moves, reconnect refresh, and offline notification recovery.
