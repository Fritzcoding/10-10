# Shared Playground: Relationship Features and Android Widgets

**Status:** Approved design; implementation planning has not started.
**Date:** 2026-10-06
**Supersedes:** The future Stage 8 item in `2026-09-30-shared-playground-roadmap.md`. Stages 0–7 remain as recorded there.

## Goal

Extend the existing couple app with practical shared planning, relationship memories, and dedicated Android home-screen widgets. Preserve the React/Vite app and Supabase foundation. Add only a small native Android layer for app widgets and native capabilities that the web app cannot provide reliably.

The current roadmap records Stages 0–6 as implemented and locally verified. Stage 7's drawing flow, private submissions, and reveal work locally; physical Android touch and reference-image upload/access remain unverified. New stages begin only after the active stage's acceptance checks are complete.

## Approved scope and order

Each stage is a separate implementation and review cycle. Write a stage-specific implementation plan and regression tests before coding; complete that stage's checks before beginning the next.

### Stage 8 — Key dates and countdowns

- Add couple-scoped milestones for anniversaries, birthdays, trips, visits, and other chosen dates.
- Support annual recurrence, timezone-aware date display, and a countdown for a selected milestone.
- Make edits and deletion visible to both partners.
- Provide in-app date reminders first; do not assume push delivery is reliable or enabled.

**Exit:** Two local accounts can create, edit, and remove dates; recurrence and timezone behavior have pure tests; unrelated accounts cannot read or change milestones.

### Stage 9 — Wishlists

- Extend the existing bucket-list concept for date ideas, places, food, gifts, and trips rather than duplicating its shared-list behavior.
- Support categories, notes, optional links, and saved/complete states where useful.
- Keep all list data couple-scoped. Mutual-interest indicators are optional and should be included only if they fit the existing schema cleanly.

**Exit:** Both partners can maintain and browse categorized ideas; category and edit rules are tested; RLS prevents access outside the couple.

### Stage 10 — Shared calendar and date planning

- Build an in-app shared calendar for events and plans with date/time, timezone, title, and optional notes.
- Provide calendar and upcoming-agenda views, and allow a plan to reference a wishlist item or milestone.
- External Google, Apple, and device-calendar synchronization is deferred.

**Exit:** Two accounts see event creation and edits through Realtime; timezone and all-day event rules are tested; unrelated users cannot access the calendar.

### Stage 11 — Photo memories

- Add a private shared album with photos, captions, and dates.
- Link selected memories to timeline entries and provide an “on this day” view when a prior-year memory exists.
- Use private couple-scoped Storage policies, upload type/size limits, and explicit user selection before upload.

**Exit:** Both partners can view authorized memories; an unrelated account cannot list or fetch media; upload validation and deletion behavior are covered locally.

### Stage 12 — Love notes and voice memos

- Add couple-scoped text notes and short voice recordings with author and creation date.
- Let partners save a note or memo as a memory and open/play it in the app.
- Keep voice uploads private, bounded in size and duration, and deletable by an authorized couple member.
- Do not add speech transcription or AI processing in this stage.

**Exit:** Text and audio records sync to both partners, protected media is inaccessible to unrelated users, and recording/upload failure never loses an already-saved note.

### Stage 13 — Mood check-ins and rituals

- Add optional, user-controlled mood check-ins visible to the couple.
- Add recurring weekly conversation prompts or rituals with configurable participation and reminders.
- This is a relationship feature, not a clinical or diagnostic tracker. Avoid mood scoring, health claims, and pressure-based streaks.

**Exit:** Partners control whether and when to share check-ins; visibility and retention behavior are explicit; unrelated accounts cannot read the data.

### Stage 14 — Temporary live location

- Let a user explicitly start sharing their location with their partner for a selected duration and stop at any time.
- Show sharing state, last update time, and automatic expiry to both partners.
- Do not track continuously by default. Require platform permission, explain the active share, and avoid retaining location history after the active share ends unless the user separately saves a place.
- Use the native Android capability only where background updates require it; browser geolocation alone is not treated as proof of background sharing.

**Exit:** Two accounts can start, observe, and stop a timed share; expiry is enforced server-side; permission denial, stale location, offline operation, and unrelated-user access are covered.

### Stage 15 — Shared Love Board

- Add a collaborative couple drawing board in the app, with pointer/touch input, undo/clear, and a saved shared image/state.
- Sync completed edits to both partners and use the existing private Storage/Realtime patterns where suitable.
- Allow the board's artwork to be shown in the Android Love Board widget.

**Exit:** Two accounts can draw and see the shared board update; private couple authorization and safe conflict behavior are tested; touch and keyboard alternatives work in the app.

### Stage 16 — Android companion and separate widgets

- Keep the React/Vite product as the main app. Add a minimal native Android host/widget layer; do not rewrite the app in native UI.
- Define separate widget types so users can add only the views they want:
  - Calendar agenda
  - Upcoming plans
  - Love note
  - Voice memo
  - Current shared mood
  - Active shared location and expiry
  - Chosen countdown
  - Love Board
- Support compact and expanded/resizable layouts. “2×2” and “3×3” are target layouts; launcher grids and actual dimensions vary by device.
- Configure each widget independently. Its background can use the default love theme or a user-selected picture. Provide a privacy option to hide sensitive widget content while the phone is locked.
- Widget data must use the signed-in member's authorization and couple membership; never embed a Supabase service-role/secret key or bypass RLS. Store any native session material using Android's protected storage and clear it on sign-out.
- Widgets display concise previews and open the app for full calendar, note, recording, location, or drawing interactions. A Love Board widget opens the full drawing canvas; arbitrary freehand drawing is not implemented inside the widget surface.
- Refresh on app changes and user interactions, then use authorized event-driven refresh where available. Treat background updates as best-effort and OS-controlled; do not promise uninterrupted instantaneous refresh.

**Exit:** Installable Android build includes independent configurable widget providers and per-instance backgrounds; widget configuration, sign-in/out, privacy, couple isolation, and update paths pass Android/device tests. Existing React/PWA flows remain functional.

### Stage 17 — Scheduled surprises

- Schedule a note, question, photo, challenge, or activity to become visible at a selected future time.
- Enforce availability using server time and couple membership; never expose content early through database queries, widgets, notifications, caches, or Realtime payloads.
- Make in-app availability the reliable baseline. Add authenticated push delivery only after the in-app lifecycle passes and platform delivery, privacy, and fallback behavior are tested.

**Exit:** Two accounts verify scheduled content stays hidden until its server-controlled time; notification or network failure does not lose or prematurely reveal content.

## Widget interaction and freshness constraints

Android App Widgets use restricted remote views, not arbitrary application views, and support a limited interaction model. Therefore the Love Board widget is a live preview/entry point; drawing happens in the app's full canvas. The app refreshes widget content in response to saved changes and available event-driven refresh signals. Android may defer background work, so the product can target near-live updates but cannot guarantee instant updates while a device is asleep, offline, or restricting background activity.

References:

- [Android App Widgets overview and limitations](https://developer.android.com/develop/ui/views/appwidgets/overview)
- [Jetpack Glance widget interaction](https://developer.android.com/develop/ui/compose/glance/user-interaction)
- [Android widget sizing guidance](https://developer.android.com/develop/ui/compose/glance/create-app-widget)
- [Android widget update limits](https://developer.android.com/reference/android/appwidget/AppWidgetProviderInfo)

## Security, data, and migration rules

- Couple membership remains the authorization scope for shared records and storage. Every exposed Supabase table has RLS; privileged operations validate the authenticated user and couple membership server-side.
- Keep private notes, moods, location, voice recordings, photos, and scheduled surprises private until their designed reveal point. Do not put hidden content into broad Realtime payloads, push bodies, widget caches, or logs.
- Location shares have explicit start/end times, server-enforced expiry, and a clear user stop action. Do not keep a location history by default.
- Each stage gets its own local migration(s), authorization tests, and local database replay. Do not deploy migrations to hosted Supabase without separate explicit authorization.
- Verify Supabase behavior against current official documentation when implementing each migration or storage/auth flow.
- Avoid new dependencies unless the current stack cannot satisfy the stage; document any addition in `DOCS.md`.

## Verification contract

For every stage, as applicable:

- Add a regression test first and prove it fails for the expected reason before implementation.
- Run pure-rule tests for validation, recurrence/timezone, reveal, expiry, and duplicate behavior.
- Run local pgTAP/database/Storage authorization checks using unrelated and paired accounts.
- Verify partner behavior with two authenticated local accounts in separate browser sessions; do not present a UI harness as proof of database authorization.
- Run the app and inspect important states, screenshots, browser console, mobile viewport, keyboard access, and touch interaction.
- For Stage 16, install the Android build on a target device/emulator and inspect each widget family, resize state, lock-screen privacy, account changes, refresh timing, and selected-photo backgrounds.
- Before marking a stage complete, run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`; report any device/service coverage that is unavailable without claiming it passed.
- Update `DOCS.md`, `MEMORY.md`, and the roadmap checklist only after the stage's acceptance checks pass.

## Out of scope for this roadmap

- Replacing the React application with a fully native rewrite.
- External calendar synchronization in the first shared-calendar version.
- Continuous background location tracking, indefinite location history, or hidden tracking.
- AI-generated relationship judgments, mood diagnoses, speech transcription, or automatic analysis of intimate content.
- Guaranteed real-time widget refresh while Android restricts background execution.
- Hosted migration deployment without separate approval.
