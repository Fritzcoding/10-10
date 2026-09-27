# Remote Multiplayer Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add remote Tic-Tac-Toe matches between confirmed friends on separate internet-connected devices, with bot mode, presence-aware friend selection, one-minute game requests, a persistent top-of-app request banner, and notification fallbacks.

**Architecture:** Supabase is the shared source of truth for friend-game requests, notifications, sessions, and moves. Realtime Presence supplies online grouping, Realtime Postgres changes deliver active requests and session updates, and the Hub renders the request banner above every tab. Bot games stay local and reuse pure Tic-Tac-Toe helpers.

**Tech Stack:** React 19, TypeScript, Supabase Auth/Postgres/Realtime, Vite, Node test runner, Web Push service worker and Supabase Edge Function scaffold.

**Spec:** `docs/superpowers/specs/2026-09-28-remote-multiplayer-games-design.md`

## Global Constraints

- Friend matches must work between separate internet-connected devices; they must not depend on LAN proximity.
- Bot matches are fully local and never write game data to Supabase.
- Pending game requests expire after exactly 60 seconds and cannot be accepted after `expires_at`.
- Incoming requests must appear in a persistent top section above Games, Friends, and Settings.
- Online friends are determined by Supabase Realtime Presence and listed before offline friends.
- Browser/OS notification delivery is best-effort; persisted in-app notifications remain the source of truth.
- Existing friend, chat, partner, authentication, and current Tic-Tac-Toe behavior must remain intact.
- Every behavior change follows red-green TDD and ends with `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

## Review Focus

- An acceptance click arriving at or after the 60-second deadline must not create a session: Task 2 tests the expiry boundary and guarded transition.
- Realtime reconnect or duplicate Postgres events must not duplicate request banners or notifications: Task 3 tests idempotent merging.
- A friend absent from Presence must be shown offline even when their profile exists: Task 3 tests online/offline grouping.
- A remote move from the wrong user, wrong turn, occupied cell, or completed session must not change the board: Task 6 tests each rejection.
- Browser notification permission denial or unavailable Push API must preserve the in-app request banner: Task 5 tests graceful fallback.

### Task 1: Pure game bot and remote-safe Tic-Tac-Toe rules

**Files:**
- Modify: `src/lib/ticTacToe.ts`
- Modify: `src/components/games/TicTacToe.tsx`
- Modify: `src/components/games/TicTacToe.css`
- Test: `tests/ticTacToe.test.ts`

**Interfaces:**
- Produces `getAvailableMoves(board: Board): number[]`, `chooseBotMove(state: GameState): number | null`, and `getGameOutcome(board: Board): { winner: Mark | null; draw: boolean }` for later session code.
- `TicTacToe` accepts a mode (`bot` or `local/remote`), an optional remote state, and an `onMove(index)` callback without changing the existing local default.

- [ ] **Step 1: Write failing tests** for available moves, a bot move always selecting an empty square, draw/winner outcome, and no move after a completed board.
- [ ] **Step 2: Run `npm test -- tests/ticTacToe.test.ts` and verify the new exports/tests fail for the expected missing behavior.**
- [ ] **Step 3: Implement the pure helpers and the delayed bot turn; keep the existing local board behavior unchanged.**
- [ ] **Step 4: Add the mode/callback rendering path and disabled states while preserving the current board UI.**
- [ ] **Step 5: Run `npm test -- tests/ticTacToe.test.ts`; expect all Tic-Tac-Toe tests to pass.**
- [ ] **Step 6: Commit with `feat: add bot and remote-safe tic tac toe rules`.**

### Task 2: Supabase schema, request lifecycle, and guarded expiry

**Files:**
- Create: `supabase/migrations/202609280001_add_remote_game_play.sql`
- Create: `src/lib/gameRequests.ts`
- Test: `tests/gameRequests.test.ts`

**Interfaces:**
- `GameRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired'`.
- `isGameRequestActive(request: { status: GameRequestStatus; expires_at: string }, now: Date): boolean`.
- `partitionGameRequests(requests, userId): { incoming: GameRequest[]; outgoing: GameRequest[] }`.
- `canAcceptGameRequest(request, now): boolean`.

- [ ] **Step 1: Write failing tests** for a 60-second request being active before the boundary, expired at/after the boundary, incoming/outgoing partitioning, duplicate pending detection, and guarded acceptance of only active pending requests.
- [ ] **Step 2: Run `npm test -- tests/gameRequests.test.ts` and verify the expected failures.**
- [ ] **Step 3: Implement the pure request helpers with exact timestamp comparisons and idempotent request merging.**
- [ ] **Step 4: Add `game_requests`, `game_sessions`, `notifications`, and `push_subscriptions` tables, RLS policies, indexes, partial pending uniqueness, Realtime publication, and an atomic `accept_game_request` RPC that checks `status = 'pending'` and `expires_at > now()` before creating a session.**
- [ ] **Step 5: Run the unit test and inspect the migration for the 60-second expiry, cross-user RLS boundaries, and remote-session constraints.**
- [ ] **Step 6: Commit with `feat: add remote game request schema`.**

### Task 3: Presence and authenticated request/notification data layer

**Files:**
- Create: `src/lib/gamePresence.ts`
- Create: `src/lib/gameNotifications.ts`
- Modify: `src/lib/supabaseErrors.ts`
- Test: `tests/gameNotifications.test.ts`

**Interfaces:**
- Exports `FriendProfile` and `groupFriendsByPresence(friends: FriendProfile[], onlineUserIds: ReadonlySet<string>): { online: FriendProfile[]; offline: FriendProfile[] }`.
- `mergeUniqueGameRequests(current, incoming): GameRequest[]`.
- `unreadNotificationCount(notifications): number`.
- `isExpiredNotification(notification, now): boolean`.
- Presence hook returns `{ onlineUserIds, isConnected }` and tracks the authenticated user on a shared channel.

- [ ] **Step 1: Write failing tests** for online-first grouping, duplicate request/notification merging, unread counts, and expiry filtering.
- [ ] **Step 2: Run `npm test -- tests/gameNotifications.test.ts` and verify failures.**
- [ ] **Step 3: Implement pure notification/request helpers and the Supabase Realtime Presence hook with cleanup on unmount.**
- [ ] **Step 4: Add request/notification load and subscription functions that scope rows to the current user and refetch after reconnect.**
- [ ] **Step 5: Run focused tests and type-check the data-layer interfaces.**
- [ ] **Step 6: Commit with `feat: add game presence and notification data layer`.**

### Task 4: Persistent top-of-app request banner and notification center

**Files:**
- Create: `src/components/GameRequestBanner.tsx`
- Create: `src/components/GameRequestBanner.css`
- Modify: `src/components/Hub.tsx`
- Modify: `src/components/Hub.css`
- Test: `tests/gameRequestBanner.test.ts`

**Interfaces:**
- `GameRequestBanner` receives the authenticated user ID and renders pending, non-expired incoming requests above the active tab.
- Actions are `onAccept(requestId)`, `onDecline(requestId)`, and `onDismissNotification(notificationId)`.

- [ ] **Step 1: Write failing tests** for the banner view model: visible when incoming non-expired requests exist, unread count, remaining-time display, expiry removal, and accept/decline callback payloads. Do not add a React testing dependency; test the pure view-model helpers used by the component.
- [ ] **Step 2: Run the focused test and verify failure.**
- [ ] **Step 3: Implement the pure banner view-model helpers and the banner/notification center using the Task 3 data layer; refresh every second only for display/expiry and use server timestamps for authority.**
- [ ] **Step 4: Mount the banner in `Hub` above `hub-panel`, keeping it visible while Games, Friends, or Settings is selected.**
- [ ] **Step 5: Run focused tests and manually verify tab switching does not remove the banner.**
- [ ] **Step 6: Commit with `feat: show game requests in the app banner`.**

### Task 5: Game mode chooser, online/offline friend picker, and browser notification fallback

**Files:**
- Modify: `src/components/Games.tsx`
- Modify: `src/components/Games.css`
- Create: `src/lib/browserNotifications.ts`
- Modify: `src/main.tsx`
- Create: `public/push-sw.js`
- Test: `tests/browserNotifications.test.ts`

**Interfaces:**
- `BrowserNotificationSupport = { canNotify: boolean; permission: NotificationPermission | 'unsupported' }`.
- `notifyGameRequest(title, body, data): Promise<boolean>` returns false without throwing when permission is denied or unsupported.
- Games mode state is `directory | mode-picker | friend-picker | bot | remote`.

- [ ] **Step 1: Write failing tests** for notification permission denial, unsupported browsers, successful notification dispatch, and online-first friend-picker ordering.
- [ ] **Step 2: Run the focused tests and verify failure.**
- [ ] **Step 3: Implement best-effort browser notification helpers, register the service worker, and keep persisted in-app notifications as the fallback.**
- [ ] **Step 4: Add the Tic-Tac-Toe mode chooser and friend picker; show online friends first, then offline friends, and create a request through the Task 3/2 interfaces.**
- [ ] **Step 5: Run focused tests and verify the existing game directory/back navigation still work.**
- [ ] **Step 6: Commit with `feat: add game mode and friend picker`.**

### Task 6: Remote Tic-Tac-Toe session and synchronized moves

**Files:**
- Create: `src/lib/gameSessions.ts`
- Create: `src/components/games/RemoteTicTacToe.tsx`
- Modify: `src/components/games/TicTacToe.tsx`
- Modify: `src/components/games/TicTacToe.css`
- Test: `tests/gameSessions.test.ts`

**Interfaces:**
- `createRemoteSession(requestId): Promise<GameSession>` uses the guarded RPC.
- `submitRemoteMove(session, userId, index): Promise<GameSession>` rejects wrong player, wrong turn, occupied square, invalid index, and completed sessions.
- `RemoteTicTacToe` subscribes to one session channel and renders server-confirmed state.

- [ ] **Step 1: Write failing tests** for X/O assignment, valid moves, all five invalid-move cases, winner/draw completion, and duplicate realtime payloads.
- [ ] **Step 2: Run `npm test -- tests/gameSessions.test.ts` and verify failure.**
- [ ] **Step 3: Implement the session/move validation helpers and Supabase calls; never optimistically commit an unconfirmed remote board.**
- [ ] **Step 4: Implement the remote board subscription and reconnect reload path.**
- [ ] **Step 5: Wire banner acceptance to session creation and Games remote mode.**
- [ ] **Step 6: Run focused tests and verify two clients converge on the same session state.**
- [ ] **Step 7: Commit with `feat: add synchronized remote tic tac toe`.**

### Task 7: Web Push delivery scaffold and end-to-end verification

**Files:**
- Create: `supabase/functions/send-game-push/index.ts`
- Create: `supabase/functions/send-game-push/README.md`
- Modify: `README.md`
- Modify: `DOCS.md`
- Modify: `MEMORY.md`

**Interfaces:**
- The Edge Function accepts a game-request notification event, loads recipient `push_subscriptions`, and sends best-effort Web Push using VAPID secrets; it must not fail request creation when push delivery is unavailable.

- [ ] **Step 1: Add deployment/configuration documentation for VAPID public/private keys, Supabase function secrets, browser permission, and the in-app fallback.**
- [ ] **Step 2: Implement the Edge Function with validation, per-subscription failure isolation, and no sensitive keys in client code.**
- [ ] **Step 3: Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`; expect all to pass.**
- [ ] **Step 4: Manually verify with two authenticated browsers on different networks: presence grouping, top-banner request delivery, 60-second expiry, accept/decline, synchronized moves, reconnect recovery, stored offline notifications, and browser push when configured.**
- [ ] **Step 5: Commit with `feat: document and scaffold game push delivery`.**
