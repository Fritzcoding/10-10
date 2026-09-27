# UID Search and Direct Chat Design

## Goal

Make numeric UID discovery reliably render a profile, allow the signed-in user to send a friend request without losing the result card, and provide a direct chat panel for that profile.

## Search flow

`Friends` trims the submitted input and branches numeric input to `profiles.display_uid`. Non-numeric input uses `profiles.email`. Search selects only `id`, `display_uid`, `email`, and `display_name`, avoiding optional profile columns that can make a valid search fail. A successful result remains visible after a friend request is sent and shows the request state.

## Direct chat flow

The searched profile and confirmed friends expose a Chat action. The chat panel loads messages between the current user and selected profile, sends new messages, and subscribes to Supabase Realtime inserts for that conversation. Messages are stored in `public.direct_messages` and protected by RLS so only the sender or recipient can read a message; inserts require the authenticated user to be the sender.

## Error handling

Search, message loading, and sending report inline errors and always clear their loading state. Empty messages are rejected locally. Missing profiles or messages result in an explanatory status rather than a blank panel.

## Verification

Add pure-function tests for profile search projection, request-state presentation, and chat conversation matching. Run `npm test`, `npx tsc --noEmit`, and `npm run build`.
