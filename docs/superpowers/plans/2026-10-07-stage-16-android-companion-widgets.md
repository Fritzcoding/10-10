# Stage 16: Android Companion Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a minimal installable Android host for the existing React app with eight independent, configurable relationship widgets.

**Architecture:** Keep React/Vite as the full app and package its production assets in a small native Android WebView host. Sync the signed-in Supabase session into Android-protected storage through a narrow JavaScript bridge; native widget requests use only that member's access token and existing RLS, with session material cleared on sign-out. Implement eight distinct AppWidget providers that share one compact RemoteViews renderer and per-instance configuration/data refresh path.

**Tech Stack:** Existing React, Vite, TypeScript, Supabase JS, Node tests; Android Kotlin, Android WebView, AppWidget RemoteViews, Android Keystore-backed storage, and Gradle.

**Spec:** `docs/superpowers/specs/2026-10-06-relationship-features-and-android-widgets.md`, Stage 16.

## Global Constraints

- Keep the React/Vite product as the main app; do not rewrite the app in native UI.
- Define separate widget types: Calendar agenda, Upcoming plans, Love note, Voice memo, Current shared mood, Active shared location and expiry, Chosen countdown, Love Board.
- Support compact and expanded/resizable layouts. “2×2” and “3×3” are target layouts; launcher grids and actual dimensions vary by device.
- Configure each widget independently. Its background can use the default love theme or a user-selected picture. Provide a privacy option to hide sensitive widget content while the phone is locked.
- Widget data must use the signed-in member's authorization and couple membership; never embed a Supabase service-role/secret key or bypass RLS. Store any native session material using Android's protected storage and clear it on sign-out.
- Widgets display concise previews and open the app for full calendar, note, recording, location, or drawing interactions. A Love Board widget opens the full drawing canvas; arbitrary freehand drawing is not implemented inside the widget surface.
- Refresh on app changes and user interactions, then use authorized event-driven refresh where available. Treat background updates as best-effort and OS-controlled; do not promise uninterrupted instantaneous refresh.
- Keep all Supabase migrations local; this stage is expected to need no schema change.
- Before marking a stage complete, run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`; report any device/service coverage that is unavailable without claiming it passed.

## Review Focus

- Expired, missing, or signed-out sessions must never leave private content in a widget; clear cached previews and protected session material.
- A widget configured for one account must not show that account's cached content after another account signs in.
- While locked, the privacy option must conceal note, voice, mood, and location details; unlocking restores the configured preview.
- Unsupported or deleted user-selected photos must fall back to the default theme without breaking the widget.
- Resizing must remain readable across launcher size buckets and avoid promising a specific cell grid or refresh interval.

---

### Task 1: Android host and session bridge

**Files:**
- Create: `android/` minimal Gradle application, Kotlin WebView host, manifest, and resources.
- Modify: `package.json`, `src/lib/supabase.ts`, `src/App.tsx` only as needed to build/copy the web bundle and send auth lifecycle events.
- Test: `tests/androidSessionBridge.test.ts`.

**Interfaces:**
- JavaScript exposes `window.AndroidSession.configureBackend(url, anonKey)`, `window.AndroidSession.setSession(accessToken, refreshToken, expiresAt)`, `window.AndroidSession.clearSession()`, and `window.AndroidSession.refreshWidgets()` only when the native bridge exists. The URL and anon key are public app configuration; every data request still uses the current member access token and RLS.
- Android stores session data using Android-protected storage, rejects empty/expired session values, and deletes all session values on clear.

- [x] Add a failing test for auth sign-in, refresh, and sign-out bridge dispatch, including no-op behavior in ordinary browsers.
- [x] Run `npm test -- tests/androidSessionBridge.test.ts`; confirm the missing bridge behavior fails.
- [x] Add the minimal WebView shell that loads bundled Vite assets and the allowlisted session bridge; do not enable general file access or arbitrary JavaScript interfaces.
- [x] Run the focused bridge test and Android Gradle debug build; confirm browser mode remains a no-op and the native build packages the app.

### Task 2: Shared widget data and secure lifecycle

**Files:**
- Create: `android/app/src/main/java/.../widget/WidgetData.kt`, protected session storage, and widget update receiver.
- Modify: `android/app/src/main/AndroidManifest.xml`.
- Test: Android unit tests for signed-out, expired-session, refresh, account-change, and RLS-backed fetch handling.

**Interfaces:**
- `WidgetData.load(type, accessToken)` returns a minimal type-specific preview or an empty signed-out/error state; it must not retain the access token in widget preferences or intent extras.
- `WidgetRefreshReceiver.refreshAll(context)` refreshes all installed provider instances after an authenticated app data change.

- [x] Add tests that prove expired/sign-out/account-change state clears prior private previews and never falls back to another account's cached content.
- [ ] Run the focused Android unit tests and confirm the expected failures before implementation.
- [x] Implement authorized reads through the configured Supabase URL and anon key using the user's access token; rely on existing RLS and never use privileged keys.
- [x] Implement app-triggered widget refresh and OS-appropriate best-effort periodic refresh; retain only safe preview data required by RemoteViews.
- [x] Run focused Android tests and inspect the built APK; no credential value was found (one generic marker came from bundled dependency text).

### Task 3: Eight independent widget providers and configuration

**Files:**
- Create: eight provider declarations/metadata, one shared RemoteViews layout/renderer, per-instance config activity, and native widget UI tests under `android/app/src/`.
- Modify: Android launcher manifest and `src` navigation deep-link handling as needed.

**Interfaces:**
- Each widget instance stores its type, default/custom background URI, and lock-screen privacy choice under its unique `appWidgetId`.
- The shared renderer selects compact/expanded content from provider type and current available dimensions.
- Tapping a widget opens the existing React app at the relevant feature route; Love Board opens the full drawing surface.

- [ ] Add provider/configuration tests covering all eight widget types, per-instance isolation, image-picker cancellation/deleted URI fallback, resize buckets, privacy toggle, lock/unlock, and app routes.
- [ ] Run focused Android tests and confirm expected failures before implementation.
- [x] Implement the eight separate providers and independently configurable instances with default love theme or a persisted user-selected picture.
- [x] Hide sensitive preview text while locked when privacy is enabled and refresh after lock-state changes; leave non-sensitive types usable.
- [x] Run Android unit/build checks; inspect widget metadata for resize support and configuration entry points.

### Task 4: End-to-end verification and stage record

**Files:**
- Create: `docs/verification/stage-16/` browser/device steps and screenshots.
- Modify after exit checks pass: `DOCS.md`, `MEMORY.md`, and the Stage 16 status in the roadmap spec.

- [ ] Build and install the Android package on an Android emulator or target device; verify each provider, independent configuration, resizing, selected-photo backgrounds, lock-screen privacy, sign-in/out/account change, and refresh.
- [ ] Run the existing React app on localhost and inspect existing PWA/auth/Hub/relationship flows in two separate browser sessions; inspect DOM and console and capture screenshots of relevant unchanged flows plus native handoff states where available.
- [ ] Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, Android Gradle tests/build, and `git diff --check`; fix failures before recording completion.
- [ ] Update `DOCS.md`, `MEMORY.md`, and the roadmap status only after the required checks pass; record unavailable device/external coverage without marking the stage complete.
- [ ] Record commit message in `DOCS.md`: `Stage 16: Add Android companion widgets`.

## Current verification record (2026-10-08)

- Added a stale-response guard so a widget preview is rendered only for the same account and session expiry that fetched it. Added regression coverage for account switch, cleared/expired session, and token refresh. Lock privacy now checks whether the keyguard is visible, including swipe-only locks; focused and full Android unit tests pass.
- Final Android `:app:testDebugUnitTest :app:assembleDebug` passed (6 tests). APK scan found no credential values; a generic `service_role` marker appears in bundled third-party JavaScript text only. Web verification passed: 160 tests, lint, TypeScript, production build, and diff check.
- The initial retry could not repeat the two-account browser flow because the remote browser controller could not reach the host-local Vite server. Its first emulator capture showed a paired Hub header with an unpaired Us empty state; the later direct WebView inspection below loaded shared Us data and did not reproduce that mismatch.
- Follow-up: started a healthy local Vite instance on port 5174 and verified it from a local Chrome-based Playwright process (birthday onboarding; no page errors; screenshot `docs/verification/stage-16/retry-local-browser.png`). The remote browser controller still could not reach host loopback. Attached directly to the already signed-in Android WebView (UID #5): Hub showed paired status and Us loaded the shared daily question, calendar, and other shared content; the unpaired empty message was absent. No page errors were observed, and a cropped screenshot is saved as `docs/verification/stage-16/emulator-shared-space.png`. Hosted read-only queries confirm UIDs #5 and #6 are the two members of one couple. The earlier UI mismatch is not reproducible after data load; it may have been a transient capture. This is one authenticated client, not a repeat of the two-browser flow.
- Read-only hosted Supabase review: every exposed `public` table has RLS enabled. The security advisor reports 32 callable `SECURITY DEFINER` routines, one private table with RLS and no direct policies (`private.tiny_game_decks`), and disabled leaked-password protection. Catalog review found fixed empty search paths; no unauthenticated access path was identified in the reviewed RPC/helper/trigger grants, but the advisor findings remain release follow-up. The performance advisor reports 29 unindexed foreign keys, five RLS init-plan warnings, and one unused index. No hosted setting or schema was changed.
- Emulator resize handles were visible but resizing was not exercised. The swipe-only emulator lock screen has no lock-screen widgets, so privacy behavior and Samsung device behavior remain unverified. Stage 16 exit criteria remain open.

### Widget report follow-up (2026-10-08)

- Reproduced widget failures after a fresh APK reinstall that preserved app data. The backend URL and encrypted Android session were present; safe logs showed the valid session being synchronized. The Calendar, Love Note, and Love Board requests failed with `UnknownHostException`.
- Emulator Wi-Fi was connected, but its resolver could not resolve Supabase or `google.com`. Windows could resolve the Supabase host. Restarting the same Pixel 9 Pro AVD with the current host DNS resolver preserved app data, restored Supabase name resolution, and refreshed the widgets to authenticated empty states. Screenshot: `docs/verification/widget-debug/widget-after-dns.png`; no widget request errors were logged after the fix.
- Compared local Docker migration history with hosted Supabase: both match through Stage 15 (`20261007200000_stage_15_love_board`). Hosted Stage 8–15 tables exist with RLS enabled. No migrations or hosted settings changed during this diagnostic.
- Added safe `CoupleWidgetData` diagnostics for backend/session availability, REST status, and exception class. No tokens, anon key, or row content are logged. Android unit tests and `:app:assembleDebug` passed.
- The emulator DNS override is specific to this host network and is not part of app code. Stage 16 remains incomplete: resize, all provider data variants and tap routes, sign-out/expiry/account switching, and lock-screen privacy on a capable target still need acceptance checks.

- Web bridge and feature-route tests pass; the route test was first observed failing because `widgetTargetId` was missing. Browser verification exposed that the calendar link selected the Us tab without scrolling; the route now waits for the shared-space loading state and a short layout settle before scrolling. Both authenticated browser sessions (UIDs #4 and #5) landed on the shared calendar at 384×832.
- Both accounts displayed their pairing state. UID #5 saw UID #4's shared love note and shared mood while the private mood remained hidden. Console error/warning lists were empty. Screenshots were captured and visually inspected in the browser session, but are not saved as repository image artifacts.
- `npm test` (160), lint, TypeScript, production build, `git diff --check`, Vite asset sync, and parsing all 13 Android XML files passed. Existing chunk-size and ineffective-dynamic-import warnings remain.
- Android Studio's JBR/Gradle and the emulator are available. `:app:testDebugUnitTest` and `:app:assembleDebug` pass; the APK installs and launches. The widget refresh-token validator now accepts the hosted session's valid 12-character refresh token; its regression test passes, and the widget shows the authenticated empty state instead of “Open the app to sign in.”
- A selected-photo failure was traced to the launcher lacking permission to open the app's document URI. The provider now downsamples the photo into a bitmap and uses a lighter content scrim; the emulator screenshot confirms the selected background is visible and logcat has no RemoteViews permission/rendering error. All eight widget types appear in the provider picker; Love Board empty state and default theme render.
- Hosted Supabase was aligned through local Stage 15 by applying only the missing migrations; no reset, seed, Stage 16 migration, or package was added. Local two-account browser pairing and shared note visibility were verified. Node tests (160), lint, TypeScript, production build, `git diff --check`, Android JUnit/build pass. Existing chunk-size and ineffective dynamic-import warnings remain.
- Stage 16 remains incomplete: the fresh two-browser account flow, resize action, account changes, signed-out/expired session behavior, and a true lock-screen widget privacy scenario still need verification. The remote browser cannot reach host loopback; the new local browser context has no test account credentials. The emulator lock screen does not display home-screen widgets, so privacy could not be exercised there. Physical Galaxy behavior is unavailable. Do not start Stage 17 until Stage 16 exit criteria pass. Do not mark the roadmap stage complete or record its commit instruction yet.
- Cold-launch route regression (2026-10-08): repro showed `Us` mounted before Supabase auth restoration; `loading` became false while `coupleId` was empty, so the one-shot scroll ran before its destination existed. Added and first observed failing a `shouldScrollToWidgetTarget` regression test; implementation now waits for the signed-in couple and reruns when `coupleId` resolves. Fresh APK install/launch lands on Love Notes once authenticated. Captures: `docs/verification/stage-16/android-widget-note-route-1s.png`, `android-widget-note-route-5s.png`, `android-widget-note-fixed-settled.png`.
- Post-fix verification: 162 Node tests, lint, TypeScript, production build, `git diff --check`, Android `:app:testDebugUnitTest`, and `:app:assembleDebug` pass. Existing chunk-size and ineffective dynamic-import build warnings remain. Android system WebView diagnostics and localhost mixed-content INFO messages remain visible; no app JS exception was observed in the captured run. Stage 16 acceptance is still open for resize, all eight provider data and tap variants, session/account lifecycle, and lock-screen privacy on a capable device/launcher.
- Authenticated widget data proof: saved `Stage 16 widget refresh check` in the emulator's synthetic hosted test couple; the widget query returned one love note and the home-screen widget displayed it. Tapping it opened the matching Love Notes section. Screenshot: `docs/verification/stage-16/android-widget-hosted-populated.png`. Cleanup is not verified; the test note remains in hosted data because the deletion did not complete and an automatic review rejected the subsequent broader delete attempt. Remove before release.
