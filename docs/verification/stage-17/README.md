# Stage 17 local verification record

Date: 2026-10-08

## Verified

- Two isolated localhost origins used two authenticated disposable accounts (UID #232 and #233), paired only in the local database.
- The scheduled note and photo were not visible to the partner before their local database release time. After advancing the release timestamp locally and refreshing, the partner saw each surprise, including the photo and caption.
- The pending photo was canceled through the app after verification. The photo object was confirmed absent from local Storage; both disposable auth users and the synthetic local couple were removed with exact-scope guards.
- Browser console warning/error lists were empty in the tested flows. “Us” in-page navigation, local music selection, persistence after reload, and reset to the default were checked in-browser.
- Node tests: 168 passed. Lint, TypeScript, production build, and `git diff --check` passed.
- Local Supabase pgTAP: 396 checks passed across 16 files; the scheduled-surprises suite contributed 32 assertions.
- Local database advisors ran. Five existing RLS initialization-plan performance warnings affect older `friend_requests`, `notifications`, and `push_subscriptions` policies; no Stage 17-specific advisor finding was reported.
- Android unit tests and debug APK build passed during implementation. Hosted Supabase was not changed.

## Still required before Stage 17 acceptance

- Repeat a clean migration replay and obtain a complete local schema diff. `supabase db diff --local` stalled while preparing its shadow database and was stopped.
- Save screenshot files for empty, pending, and released surprise states. The browser captures were visually inspected during the verification session but were not saved as durable artifacts.
- Verify narrow/mobile layout, keyboard accessibility, offline/retry behavior, and inspect browser network payloads for unreleased content.
- Verify local audio-file selection in Android WebView. Physical-device behavior is also unverified.

Stage 17 is implemented and core checks pass, but is not marked accepted. Its migration remains local; Stage 16 remains a separate incomplete release gate.
