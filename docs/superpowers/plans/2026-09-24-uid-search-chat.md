# UID Search and Direct Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make UID search render a usable profile card, keep it available for friend requests, and add direct realtime chat.

**Architecture:** Keep profile search and request state in `Friends.tsx`, add a focused pure chat helper module for conversation filtering, and add a Supabase migration for the `direct_messages` table and RLS. The UI uses the existing Friends panel and no new dependencies.

**Tech Stack:** React, TypeScript, Supabase JS, Supabase Postgres/Reatime, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-24-uid-search-chat-design.md`

## Global Constraints

- Numeric profile lookup must use `profiles.display_uid`; non-numeric lookup must use `profiles.email`.
- Search projection must not include optional profile fields required only by friend/request views.
- No new npm packages.
- Preserve unrelated working-tree changes.
- Run `npm test`, `npx tsc --noEmit`, and `npm run build` before completion.

## Review Focus

- A valid numeric UID returns a visible card even when optional profile columns are absent; test `profileSearchFields`.
- Sending a request does not remove the searched profile card; test `friendRequestStatusLabel`.
- A chat only shows messages involving both selected users; test `isConversationMessage`.
- Empty/whitespace messages do not reach Supabase; verify the handler guard in the component and the TypeScript build.
- Realtime messages do not duplicate an already loaded message; test `appendUniqueMessage`.

### Task 1: Search projection and request-result persistence

**Files:**
- Modify: `src/components/Friends.tsx`
- Modify: `src/lib/friendSearch.ts`
- Modify: `tests/friendSearch.test.ts`

**Interfaces:**
- Produce `profileSearchFields = 'id, display_uid, email, display_name'`.
- Produce `friendRequestStatusLabel(isFriend, hasPendingRequest)` returning `'Friends'`, `'Request sent'`, or `'Add Friend'`.

- [ ] Write failing tests for the projection and request labels.
- [ ] Run `npm test`; confirm the new exports are missing.
- [ ] Implement the two helpers and use the minimal projection in UID/email search.
- [ ] Keep `searchResult` after a successful insert and render status plus Chat action.
- [ ] Run `npm test` and confirm all tests pass.

### Task 2: Direct-message persistence and pure helpers

**Files:**
- Create: `supabase/migrations/202609240002_add_direct_messages.sql`
- Create: `src/lib/chat.ts`
- Modify: `tests/friendSearch.test.ts`

**Interfaces:**
- `ChatMessage = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string }`.
- `isConversationMessage(message, userId, otherUserId)` returns whether both participants match.
- `appendUniqueMessage(messages, message)` preserves order and avoids duplicate IDs.

- [ ] Write failing tests for conversation matching and duplicate prevention.
- [ ] Run `npm test`; confirm the new exports are missing.
- [ ] Implement the helpers.
- [ ] Add `direct_messages` with UUID primary key, sender/recipient profile foreign keys, body, created timestamp, indexes, RLS, and authenticated sender/participant policies.
- [ ] Run `npm test` and confirm all tests pass.

### Task 3: Chat UI and realtime integration

**Files:**
- Modify: `src/components/Friends.tsx`
- Modify: `src/components/Friends.css`
- Modify: `DOCS.md`
- Modify: `MEMORY.md`

**Interfaces:**
- Chat selection is a `Profile | null` state.
- Chat loading queries `direct_messages` in both participant directions, sorts by `created_at`, and filters through `isConversationMessage`.
- The realtime subscription listens for inserts on `direct_messages`, filters through `isConversationMessage`, and appends through `appendUniqueMessage`.

- [ ] Add a Chat button to search results and confirmed friends.
- [ ] Add chat history, composer, send button, close button, loading state, and inline errors.
- [ ] Subscribe/unsubscribe on selected profile changes and keep the latest conversation visible.
- [ ] Update project memory/docs with the completed UID/chat flow.
- [ ] Run `npm test`, `npx tsc --noEmit`, and `npm run build`.

