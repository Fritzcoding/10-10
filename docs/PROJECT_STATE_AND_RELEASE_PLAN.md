# Project State and Release Plan

Updated: 2026-10-08

## Goal

Publish a reliable, secure, polished Couple App that works as a web/PWA app and Android companion, with shared features behaving correctly for both partners. A release cannot be guaranteed to be literally flawless; the release bar is no known critical/high-impact defects, all defined checks passing, and limitations documented before publishing.

## Current state

- Roadmap Stages 1–15 are recorded as complete. Stage 17 was implemented first at the user's direction; its core local acceptance checks passed, with some required verification still outstanding. Stage 16 remains an incomplete release gate.
- The product is React/Vite/TypeScript with Supabase Auth, Postgres/RLS, Storage, and Realtime. Android is a small Kotlin WebView host with eight AppWidget providers.
- The hosted Supabase schema was explicitly synchronized through local Stage 15 by applying the missing migrations only. No reset or seed was run. Future migrations remain local unless deployment is explicitly authorized.
- Two authenticated local browser sessions verified pairing and shared-note visibility. The Android emulator build installs and launches.
- The Android widget sign-in message first exposed a validator rejecting a valid 12-character refresh token; that validator was fixed and has regression coverage. A later emulator reproduction uncovered a separate network cause: its Wi-Fi was connected, but DNS could not resolve public hosts. After restarting the same Pixel 9 Pro AVD with the host's configured DNS resolver, the authenticated widgets refreshed correctly. Do not hardcode the host-specific DNS override in the app. Evidence: `docs/verification/widget-debug/widget-after-dns.png`.
- Custom widget photos initially failed because the launcher could not read the app's document URI. The provider now sends a downsampled bitmap and uses a lighter text scrim. The selected photo is visible in the emulator screenshot at `docs/verification/stage-16/widget-photo-final.png`.
- Current verification has passed: 162 web tests, lint, TypeScript, production build, `git diff --check`, Android unit tests, and Android debug build. Existing build warnings include a large JavaScript chunk and ineffective dynamic imports.
- Fresh emulator verification fixed a cold-launch route race: widget taps now wait for the authenticated couple before scrolling to the target. A temporary note saved from the emulator appeared in the home-screen widget and its tap opened Love Notes; evidence: `docs/verification/stage-16/android-widget-hosted-populated.png`. The temporary hosted test note remains because cleanup did not complete; remove it before release.
- Android widget previews are now bound to the account and session expiry that fetched them, preventing a late response from repainting old-account content. Lock privacy checks keyguard visibility, including swipe-only locks. Six Android unit tests and the final debug build pass. APK review found no embedded credential values; the only secret marker was generic bundled dependency text.
- Fresh localhost testing in two distinct browser sessions verified the UID #209/#210 friend request, partner request/acceptance, paired state, and a shared love note appearing for the other account. The current UID #210 browser shows Us/calendar content; its browser console has no warnings or errors. Earlier account screenshots were visually inspected but are not persisted as files.
- Local Docker and hosted Supabase migration histories were compared read-only and match through Stage 15 (`20261007200000_stage_15_love_board`). Hosted Stage 8–15 tables are present with RLS enabled. No hosted migrations or settings changed in this widget follow-up.
- Read-only hosted Supabase advisors: all exposed `public` tables have RLS. Security findings include 32 callable `SECURITY DEFINER` routines (catalog review found pinned empty search paths and no unauthenticated path in the reviewed RPC/helper/trigger grants), `private.tiny_game_decks` with no direct policy, and leaked-password protection disabled. Performance findings include 29 unindexed foreign keys, five RLS init-plan warnings, and one unused index. These are recorded for release hardening; no hosted schema or auth setting was changed.
- The emulator lock screen does not host home-screen widgets, so widget privacy while locked is not verified. Physical Samsung Galaxy behavior is not verified. Resize and account-change/session-expiry flows remain outstanding. The emulator needs a DNS override when its default `10.0.2.3` resolver fails on this host's network; Windows DNS resolution was healthy.
- “Us” now has in-page navigation across its feature sections. Settings now provides a soothing default loop and local user-selected music saved on-device. Browser interaction verified selection persistence; Android WebView file selection remains unverified.

## Problems to solve

1. **Stage 16 acceptance is incomplete.** The signed-in widget and custom background paths are repaired, but resize behavior, all provider data paths, widget taps/deep links, refresh behavior, account changes, sign-out/expiry handling, and lock-screen privacy still need full checks.
2. **Stage 17 acceptance follow-ups remain.** Core two-account note/photo release, local database authorization tests, and no-console-error browser checks passed. A full clean migration replay/schema diff/advisor run, narrow viewport/keyboard acceptance, durable screenshot artifacts, offline/retry failure injection, browser payload trace, and Android WebView file chooser remain outstanding.
3. **Requested UI/audio improvements are implemented, with platform checks pending.** “Us” section navigation and local repeating music selection work in the browser; Android WebView picker behavior needs device verification.
4. **Release validation remains.** Verify current hosted configuration, production build/signing, device behavior, privacy/security, and Play Store submission requirements before publishing.

## Implementation order

### 1. Close Stage 17 acceptance follow-ups

- Keep its migration local. Do not deploy it to hosted Supabase without separate explicit authorization.
- Run clean local migration replay, schema diff, and applicable advisors once Docker is available; rerun the focused and full pgTAP suites.
- Save reviewable screenshots for empty, pending, and released states; test narrow mobile layout, keyboard, offline/retry behavior, and browser network payload privacy.
- Verify local music selection in Android WebView and note platform-specific limitations.
- Stage 17 implementation commit message: `Stage 17: Add scheduled surprises`.

### 2. Finish Stage 16 before release

- Keep changes focused on the existing Android host and providers; avoid adding packages unless necessary.
- Verify each of the eight widget types with an authenticated account, empty and populated data where available, correct tap destination, and safe behavior when data/session is unavailable.
- Exercise compact/expanded resizing, per-widget configuration isolation, default and selected backgrounds, photo cancellation/deletion/fallback, refresh after app changes, and opening the right app section.
- Verify sign-in, sign-out, expired session, and account switching. Confirm one account's content is never displayed after another account signs in.
- Verify the lock privacy option on a device/launcher that can actually show widgets on the lock screen. Until that is possible, record the limitation and do not claim the check passed.
- Run the localhost app and two isolated browser sessions for shared flows; inspect rendered UI, console output, and screenshots. Re-run web tests, lint, typecheck, build, Android tests/build, and diff check.
- Keep Stage 16 open until its exit checks pass. Use the exact recorded commit message: `Stage 16: Add Android companion widgets`.

### 3. Verify “Us” navigation and audio settings

- Verify anchor targets, keyboard access, narrow mobile layout, and widget deep links.
- Verify local music selection, persistence, repeat behavior, volume, reset, and Android WebView file selection. Personal music remains on-device.
- Verify supported file types, cancellation, unavailable/deleted files, playback/loop behavior, volume, and Android WebView file selection. Keep the web and Android behavior consistent or clearly explain platform limits.

### 4. Release hardening and publishing

- Run the complete automated suite and relevant local database/policy checks from a clean checkout. Review warnings and remove or justify new warnings introduced by the release changes.
- Test production configuration—not only localhost—including Supabase URL/key selection, auth redirect/confirmation behavior, deep links, storage policies, RLS, migrations, and network failures. Never put service-role keys, signing secrets, or private credentials in the client or repository.
- Verify Android release signing, versioning, target SDK, permissions, app icon/name, privacy disclosures, data safety answers, and a release build installed on the intended Android version(s). Keep signing keys and store credentials in their approved secure storage.
- Verify PWA install/update/offline behavior and supported browser/mobile layouts. Check accessibility basics, loading/empty/error states, data recovery and deletion, and that no temporary test accounts or shared test content remain.
- Capture final screenshots and a short test record. Use staged/internal testing before wider release, monitor auth/database/storage/crash signals, and prepare a rollback path.
- Publish only after all release gates pass and any known limitations are accepted. No document or test run can prove a zero-defect release; record evidence and residual risk accurately.

## Release gates

- [ ] Stage 16 acceptance checks pass or any unavailable device check is explicitly accepted and documented.
- [ ] Stage 17 server-time reveal and two-account authorization checks pass.
- [ ] Stage 17 outstanding replay, offline/payload privacy, mobile accessibility, and saved screenshot evidence checks pass.
- [ ] “Us” navigation and requested audio settings pass mobile and Android WebView checks.
- [ ] Web test, lint, typecheck, production build, local database/RLS checks, Android unit/build, and diff checks pass.
- [ ] Two-account shared flows pass in separate authenticated sessions; private data isolation is confirmed.
- [ ] Browser console and Android logcat have no new unexplained errors; screenshots cover important success, empty, and failure states.
- [ ] Hosted schema/configuration and release secrets are reviewed; migrations are deployed only with explicit authorization.
- [ ] Release build, signing, privacy/store materials, backup/rollback, and staged test plan are ready.
- [ ] No known critical/high-impact issue remains open; remaining limits are documented.

## Reference documents

- Roadmap spec: `docs/superpowers/specs/2026-10-06-relationship-features-and-android-widgets.md`
- Stage 16 plan: `docs/superpowers/plans/2026-10-07-stage-16-android-companion-widgets.md`
- Progress and exact stage commit messages: `DOCS.md`
- Current implementation memory: `MEMORY.md`
- Stage 16 emulator evidence: `docs/verification/stage-16/`
- Stage 17 implementation plan: `docs/superpowers/plans/2026-10-08-stage-17-scheduled-surprises.md`
