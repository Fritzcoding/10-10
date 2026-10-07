# Stage 8 — Key Dates and Countdowns

## Goal
Add a couple-scoped milestones surface with annual recurrence, timezone-aware countdowns, editing/removal, and in-app upcoming-date reminders.

## Implementation order
1. Add pure rule tests first for date validation, annual recurrence (including Feb 29), local-day countdown boundaries across timezones, and ordering of upcoming milestones.
2. Add a local-only migration for `relationship_milestones` with couple membership RLS, authenticated CRUD grants, field constraints, and Realtime publication. Use date-only values for milestones to avoid DST shifting; store timezone on the couple (existing `couples.timezone`) and evaluate each user-visible calendar day consistently in that configured timezone. No hosted deployment.
3. Add a small pure rules module and integrate a Key Dates section into the existing Us tab: milestone form (title/date/category/annual toggle), list/edit/delete, choose one featured countdown, and show upcoming reminders in-app. Reuse `couples.timezone`, couple membership lookup, existing Realtime refresh conventions, existing styles, and no new dependency.
4. Add a pgTAP authorization suite for paired CRUD visibility, outsider read/write rejection, constraints, and couple isolation; replay locally.
5. Verify two local accounts in separate browsers (create/edit/delete, countdown, timezone date behavior, realtime, console, 384px layout, keyboard/touch) and capture/inspect screenshots.
6. Run npm test, lint, TypeScript, build, local pgTAP, and diff-check. Update DOCS, MEMORY, and roadmap checklist only if the exit criteria pass.

## Boundaries
- Stage 8 only; do not begin Wishlists or Calendar.
- Milestones are date-only and annual recurrence is optional. Non-annual dates remain in the past after their date.
- In-app reminders are visible from the milestone list/upcoming section; no push or OS scheduling.
- Keep existing Hub/Us functionality intact. Migrations remain local.
