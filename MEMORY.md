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
