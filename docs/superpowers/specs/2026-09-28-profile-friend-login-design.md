# Profile, Friend Loading, and UID Login Design

## Goal

Make confirmed friends reliably available to remote games, expose partner state clearly, add a Profile hub surface, and allow authentication by either email/Gmail or the app's numeric display UID.

## Behavior

- Games friend mode loads users connected by an accepted `friend_requests` row and groups them by Realtime Presence. A partner relationship is additional metadata, not a requirement for playing a friend.
- The Hub navigation order is Games, Friends, Profile, Settings.
- Profile shows the current avatar, display name, display UID, partner state/details, badges, and a small extensible “More features coming soon” area.
- Avatar customization initially stores a URL/text value in `profiles.avatar_url`; storage hosting is outside this change.
- Authentication input containing `@` uses the existing email/password Supabase flow. Input without `@` is parsed as a numeric display UID, resolved against `profiles.display_uid`, and its email is then used with the supplied password. The password remains the user's existing account password.
- Invalid or missing UID lookups show an inline authentication error and do not attempt a password login.
- Existing email login, friend requests, chat, partner requests, and settings remain compatible.

## Data changes

Add `avatar_url text` to `profiles` if absent. Keep the existing `display_uid`, `partner_id`, and `partner_name` contracts. Profile reads select optional avatar data only where the migration is available and provide an actionable fallback if it is not.

## Components and interfaces

- `friendSearch` exposes an identifier-routing helper distinguishing email from numeric display UID.
- `Profile` owns profile display-name/avatar updates, UID display/copy, partner details, badges, and future-feature placeholders.
- `Hub` owns the new Profile tab and continues to mount the persistent request banner above all tabs.
- `Games` loads accepted friend relationships and passes the confirmed friend profiles to the online/offline picker.
- `AuthModal` resolves UID identifiers before calling `signInWithPassword`.

## Testing and verification

Pure tests cover identifier routing, paired/unpaired view models, accepted-friend extraction, and profile presentation. Finish with `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
