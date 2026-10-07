# Stage 9 — Wishlists

## Goal
Expand the existing shared bucket list into categorized couple wishlists for date ideas, places, food, gifts, and trips.

## Order
1. Add pure regression tests for category validation, title/note/link limits, URL protocol safety, and saved/completed filtering.
2. Add a local migration extending `bucket_list_items` with category, note, optional URL, and saved state. Update authenticated column grants while retaining existing couple RLS and activity timeline triggers.
3. Extend the existing Us tab list and form with category, note, optional link, saved, and completed controls. Add category filtering. Keep existing bucket-list entries compatible via defaults.
4. Add local pgTAP assertions for couple isolation, allowed categories, and link constraints.
5. Verify two browser accounts can add/edit/save/complete/remove categorized ideas; inspect mobile, console, and screenshot.
6. Run full app checks, update DOCS/MEMORY/roadmap on pass. Do not start Stage 10 until Stage 9 passes.

## Limits
No new package, separate duplicate wishlist table, recommendation/ranking, external fetch for URLs, hosted migration, or Stage 10 calendar behavior.
