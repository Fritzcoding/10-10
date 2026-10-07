# Stage 14: Temporary Live Location Implementation Plan

**Goal:** Allow a signed-in partner to explicitly share a foreground device location for a bounded duration, with immediate stop and automatic server-side expiry and deletion.

**Architecture:** Store only each member's current coordinate in a couple-scoped row. RLS exposes rows only while their server-generated expiry is in the future. Start/update use authenticated RPCs; stop deletes immediately. A local/Supabase pg_cron job purges expired rows at one-minute intervals. Private Realtime broadcasts carry only a refresh signal; partners re-read coordinates through RLS. Browser watchPosition runs only after explicit start, only while the page is visible, and stops on expiry, stop, sign-out, or unmount. No background tracking, history, or coordinate buffering.

**Tech Stack:** Existing React, TypeScript, Supabase Postgres/Realtime/pg_cron, browser Geolocation API, Node test runner, and pgTAP; no new package.

## Tasks

1. Add RED pure tests for duration bounds, coordinate/accuracy validation, stale state, geolocation denial/timeout messaging, and location display formatting; then implement the small domain helper.
2. Generate a migration and pgTAP suite for authorized start/update/stop, DB-owned expiry, invisible expired rows, cron purge, couple isolation, and safe Realtime authorization. Apply locally and verify no hosted DB is touched.
3. Add a small shared-space panel with explicit duration and permission explanation, start/stop, active/expired/stale status, last update, and partner location. Keep browser tracking foreground-only, prevent offline buffering, and surface denial/unavailable/timeout failures.
4. Run pure tests, focused and full local database suites, security advisors, lint, typecheck, build, and diff check. Inspect screenshots/console and verify two authenticated local accounts using synthetic DB coordinates; do not grant or collect real browser location without a distinct user action.
5. Update `DOCS.md`, `MEMORY.md`, and roadmap only after acceptance. Keep migrations local.

## Constraints

- No location is read before the user explicitly starts; permission is requested only by that action.
- Duration is server-enforced (15, 30, or 60 minutes). Client time cannot extend it.
- Expiry blocks reads immediately; `pg_cron` physically removes rows within one minute. Stop removes the row immediately.
- No history, background polling, or offline queue. Browser tracking pauses when hidden and is not described as background sharing.
- Coordinates are never included in Realtime broadcasts or logs. Private refresh topic membership is enforced in Postgres.
- Do not deploy migrations to hosted Supabase.

## Review Focus

- Validate latitude, longitude, accuracy, owner identity, couple membership, duration, and update expiry in the database.
- Permission denial, unsupported geolocation, unavailable position, timeout, stale update, and offline errors must leave no active share on the server.
- An unrelated account cannot read or write coordinates; a partner sees only a current active share.
- Expired rows are not readable even if cron is delayed; cleanup must physically delete them.

## Verification Record (2026-10-07)

- [x] 4 focused pure tests and 27 Stage 14 pgTAP assertions pass; the full local DB suite passes 330 checks.
- [x] Two authenticated local browser sessions displayed a synthetic 0°, 0° coordinate to the partner; the row was removed after screenshot inspection. The 384×832 full-page view had no horizontal overflow; both browser consoles were clear.
- [x] Security advisors, 152 Node tests, lint, TypeScript, production build, and `git diff --check` pass. Existing chunk-size and ineffective dynamic-import build warnings remain.
- [x] Migration and pg_cron cleanup were verified on local Supabase only; no hosted migration was deployed.
- [ ] Browser geolocation permission was not requested and actual device GPS start/denial was not exercised, to avoid collecting the user's real location. The denial/timeout/unavailable messaging and no-write-before-first-position behavior are covered by code and pure tests.
