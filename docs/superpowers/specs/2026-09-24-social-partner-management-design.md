# Stage 5 Social & Partner Management Design

## Goal

Add friend discovery, friend requests, partner requests/acceptance, and user settings to the existing Supabase-backed couple hub.

## Scope

- `Friends.tsx` searches registered profiles by email, sends friend requests, displays confirmed friends, sends partner requests, and accepts incoming partner requests.
- `Settings.tsx` controls background music volume, updates the authenticated user's display name, and logs out.
- `Hub.tsx` renders the Friends and Settings panels based on the selected bottom-navigation tab.
- `App.tsx` resets the application view after logout.
- `audio.ts` exposes a volume setter for the shared audio element and fallback gain.
- `DOCS.md` and `MEMORY.md` track completion of Micro-Stages 5.1, 5.2, and 5.3.

## Data model assumptions

The existing `profiles` table is assumed to contain `id`, `email`, `display_name`, `partner_id`, and `partner_name` columns. The feature uses a `friend_requests` table with:

```text
id uuid primary key
requester_id uuid references profiles(id)
recipient_id uuid references profiles(id)
status text -- pending | accepted
request_type text -- friend | partner
created_at timestamptz
```

The authenticated user can read profiles needed for email search and confirmed-friend display, create requests addressed to another profile, read requests involving the current user, and update requests they received. Supabase Row Level Security policies remain the authority for access.

## User flows

### Friend search and requests

1. Load the authenticated user's profile and confirmed friends from `profiles`.
2. On a non-empty email search, query a matching profile while excluding the current user and already-confirmed friends.
3. Send a `pending` request if no duplicate pending request exists.
4. Show incoming pending requests with an Accept action.
5. Accepting a request changes its status to `accepted` and refreshes the confirmed friend list.

### Partner requests

1. Show “Send Partner Request” beside each confirmed friend when neither user is currently paired.
2. Create a pending partner request using the existing `friend_requests` table with a distinct request kind only if the deployed schema supports it; otherwise use the same request status and treat accepted friend requests as partner requests in this MVP.
3. Provide an Accept action for incoming partner requests.
4. On acceptance, update both profiles' `partner_id` and `partner_name` values, then refresh the local friend/partner state.

Because no migration/schema file exists in this repository, the implementation assumes the `request_type` column is available alongside the known request columns and surfaces Supabase errors in the UI rather than silently claiming success.

### Settings and logout

1. Initialize the volume slider to the shared audio volume, update it through `setBackgroundMusicVolume`, and keep the value between 0 and 1.
2. Load the current display name from `user_metadata.display_name` and save changes with `auth.updateUser`.
3. Call `auth.signOut()` and invoke the parent callback so `App` returns to the auth view.

## Error handling

- Missing Supabase configuration produces an actionable inline message.
- Empty/invalid search and display-name submissions are rejected client-side.
- Supabase errors are rendered in an alert region and do not mutate local success state.
- Async state updates are guarded against stale unmounted components where needed.

## Verification

- Run `npx tsc --noEmit`.
- Run `npm run build` as required by `AGENTS.md`.
- Manually inspect tab switching, request/accept actions, volume changes, display-name save, and logout behavior against a configured Supabase project.
