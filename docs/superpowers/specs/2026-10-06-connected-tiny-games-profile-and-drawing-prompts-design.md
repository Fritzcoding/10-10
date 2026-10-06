# Connected Tiny Games, Profile Avatars, and Drawing Prompts

## Intent

Make Memory Match, Rock Paper Scissors, and Word Chain playable against a
partner or confirmed friend over Supabase Realtime, while retaining same-device
and bot modes. Put the partner first in the people picker. Remove Bored Mode
for now. Let users upload a profile avatar from their device and give Draw
Together a shared subject and category, selected from the supplied prompt list
or entered by the requester.

## Agreed play modes

Tic-Tac-Toe and the three tiny games offer three choices:

1. **Play by yourself**: one person controls both local player turns. Memory
Match keeps its two-score pass-and-play rules; Word Chain alternates local
turns; Rock Paper Scissors reveals both choices on the same device, as it
does now.
2. **Play against a bot**: play locally against a simple game-specific bot.
3. **Play with people**: send a normal game request to a confirmed friend or
   partner. Show the partner first, then other online friends, then offline
   friends. Do not include pending or unconfirmed contacts.

For shared games, Memory Match sends card flips and turn/score state through a
server-validated action. Word Chain sends words through a server-validated,
turn-ordered action. Rock Paper Scissors stores each player's choice privately
until both submit, then reveals the single-round result for that request.
Session revisions reject stale concurrent actions. Local and bot modes remain
client-only. The memory bot prefers a known matching pair, otherwise flips a
random available pair; the word bot picks from a small built-in word list; the
RPS bot chooses randomly. The memory bot cannot inspect unrevealed card pairs.
One partner RPS request represents one simultaneous round; another round uses
the existing new-request flow.

Friend access is limited to Tic-Tac-Toe and the three tiny games. Existing
couple-only access remains in place for conversation games and Draw Together.
Only accepted friend relationships can create and accept requests or read
those sessions; an unrelated signed-in user cannot read requests, session
state, or private choices. Existing request expiration, duplicate prevention,
and identity-derived RPC behavior remain enforced.

## Bored Mode

Remove the recommendation panel, its device-local recency writes, and the
recommendation/history helpers and tests that no longer have callers. Keep the
ordinary game directory. Update the Stage 5 internal title/metadata to describe
tiny-game play modes instead of Bored Mode.

## Profile avatar upload

Replace the URL-only avatar editor with a device file picker and preview. Use a
private Supabase Storage bucket named `profile-avatars`, with stable object
path `<user-uuid>/avatar` owned by the signed-in user, and a 5 MiB maximum for
JPEG, PNG, and WebP. Save the object path in the existing `profiles.avatar_url`
column, resolving it to a short-lived signed URL for display. Storage read
access is limited to the owner and their confirmed friends/partner; writes,
replacement, and deletion are owner-scoped. Existing HTTP(S) avatar URLs remain
renderable for compatibility. Upload failure must leave the saved profile
pointer unchanged.

## Draw Together prompt

Before starting a round, the requester chooses a category and one matching
subject from the user's supplied list, or enters a custom subject and
classification. Show both fields to both players during the round and reveal.
Persist them on the existing drawing-round row through the start-round RPC so
the same server-created round is authoritative for both accounts. Keep the
reference image optional and independent from the prompt. Enforce trimmed,
non-empty subject (1–120 characters) and category (1–60 characters) in both UI
and RPC.

## Data and authorization

Add local-only migrations scoped by feature: one for friend-capable tiny-game
request/session authorization, RLS-visible tiny-game state, and validated
action RPCs; one for the private avatar bucket and policies; and one additive
migration for drawing-round subject/category and the start-round RPC update.
Preserve the current couple-only policies for other game types and preserve
all existing data. Keep the original migration history intact. Do not deploy
any migration to hosted Supabase.

Every exposed table has RLS. RPCs derive the caller from `auth.uid()`, verify
the session and its specific game type, confirm the two-player relationship,
validate turn/revision/action shape, and reject completed sessions, duplicate
or illegal actions, and hidden-choice reads. Private Storage objects use
owner- and relationship-scoped policies. Realtime publication only exposes
rows under the same SELECT authorization.

## Verification

- Pure rule tests cover mode availability, Memory Match turns/scoring and bot
  moves, legal Word Chain updates/bot replies, RPS hidden/revealed choices and
  bot outcomes, draw prompt selection/custom validation, and avatar type/size
  validation.
- Local pgTAP tests cover accepted friend vs unrelated user request/session
  access, legal actions, stale revisions, hidden RPS choice isolation, avatar
  Storage read/write
  scope, and drawing subject/category validation.
- Two authenticated local browser contexts verify partner and friend request,
  accept, realtime state sync for all three games, RPS privacy until both
  submit, and bot/self modes. Verify avatar upload from the file picker and
  partner visibility. Verify drawing prompt selection and custom prompt appear
  on both clients while the optional reference can remain empty.
- Capture and inspect screenshots for the mode picker, active partner game,
  RPS waiting/reveal, avatar editor, and drawing setup/active round at desktop
  and 384x832 CSS-pixel mobile sizes. Inspect browser console and keyboard/tap
  behavior.
- Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
  `supabase test db --local`, and `git diff --check`. Update `DOCS.md` and
  `MEMORY.md` only after verification; keep all migrations local.

## Not included

No Bored Mode replacement, public avatar URLs, broader friend access for
conversation/drawing sessions, online bot sessions, new dependencies, scoring
system beyond the existing local game rules, or hosted migration deployment.
