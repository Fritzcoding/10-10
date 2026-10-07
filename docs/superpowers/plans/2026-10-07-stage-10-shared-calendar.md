# Stage 10 — Shared Calendar and Date Planning

## Goal
Add a couple-scoped in-app calendar with a month grid, selected-day events, an upcoming agenda, timezone-aware timed events, all-day dates, and optional links to milestones or wishlist ideas.

## Implementation order
1. Add pure tests for title/note validation, time-zone conversion, invalid/nonexistent local times, all-day rules, and month-grid boundaries.
2. Add a local-only `relationship_events` migration with couple RLS, server-validated IANA timezone and same-couple references, date/time shape constraints, and private Broadcast synchronization for create/edit/delete.
3. Add a Calendar section in Us with native date/time inputs, timezone selection, all-day toggle, month navigation, agenda view, and optional milestone/wishlist links.
4. Add pgTAP coverage for partner visibility, unrelated-user isolation/write rejection, event validation, and related-record couple matching.
5. Verify two authenticated local browsers with create/edit/delete, realtime sync, all-day and timed events, mobile layout, screenshot, and console.
6. Run all checks; update DOCS/MEMORY/roadmap only on pass. Do not start Stage 11.

## Limits
No external calendar sync, push notifications, new date library, hosted migration, or native widget behavior.
