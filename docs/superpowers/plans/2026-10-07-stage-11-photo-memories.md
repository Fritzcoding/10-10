# Stage 11: Photo Memories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a private couple photo album with captions, dates, timeline links, and an anniversary view.

**Architecture:** Add one couple-scoped metadata table and private Storage bucket with upload limits and RLS. Keep upload validation and date helpers pure; add the album to the existing “Our shared space” screen and download through the authenticated Storage client.

**Tech Stack:** React, TypeScript, Supabase Storage/Postgres, pgTAP, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-06-relationship-features-and-android-widgets.md` (Stage 11).

## Global Constraints

- Couple membership remains the authorization scope for shared records and storage.
- Each stage gets its own local migration(s), authorization tests, and local database replay. Do not deploy migrations to hosted Supabase without separate explicit authorization.
- Avoid new dependencies unless the current stack cannot satisfy the stage; document any addition in `DOCS.md`.
- Upload type/size is validated in the client and constrained by the private bucket; deletion uses the Storage API.

## Review Focus

- Unrelated user tries list/download/upload/delete: pgTAP verifies couple membership is required for object access.
- Invalid MIME type, empty image, or image over 5 MiB: pure validation test rejects before upload.
- Invalid date or caption length: pure validation test rejects before database write.
- Missing/deleted timeline entry: nullable same-couple relationship is handled by database constraints.
- Prior-year matching: “On this day” uses local calendar month/day and is empty if no prior-year photo exists.

---

### Task 1: Photo memory rules and database/storage authorization

**Files:** Create `src/lib/photoMemories.ts`, `tests/photoMemories.test.ts`, `supabase/migrations/<timestamp>_stage_11_photo_memories.sql`, `supabase/tests/photo_memories.test.sql`.

**Interfaces:** `validatePhotoMemory(file: Pick<File, 'type' | 'size'>, caption: string, date: string)` returns trimmed `{ caption, date }`; `onThisDayMemories<T extends { date: string }>(rows: T[], today: string)` returns only previous-year month/day matches.

- [x] Write tests for valid JPEG/PNG/WebP, unsupported/empty/over-limit files, caption/date validation, and prior-year matching; run and observe expected failure.
- [x] Add couple-scoped metadata, private bucket (5 MiB; JPEG/PNG/WebP), and Storage/object plus metadata RLS; cover paired and unrelated users and deletion in pgTAP.
- [x] Replay local migrations and run the photo-memory pgTAP suite (16 checks; full local suite 264 checks).

### Task 2: Shared album UI

**Files:** Create `src/components/PhotoMemories.tsx`; modify `src/components/Us.tsx` and `src/components/Us.css`.

**Interfaces:** `PhotoMemories({ coupleId, userId, timeline })` manages upload, caption/date edits, display, and deletion; signed URLs are fetched only for authorized photo paths.

- [x] Verify selected-file upload, authorized partner viewing, editable metadata, and Storage API deletion in the local two-account browser flow; metadata and upload-validation branches have regression tests.
- [x] Add explicit file picker, caption/date inputs, album grid, timeline linking, and “On this day” section with accessible labels and errors.
- [x] Verify account #158 upload and account #157 partner view/“On this day”, then remove the memory and confirm the empty state. pgTAP covers unrelated-user metadata and Storage policy isolation; console was clear and the mobile view was captured and inspected at 384×832.
- [x] Run `npm test` (140), `npm run lint`, `npx tsc --noEmit`, `npm run build`, local pgTAP, and `git diff --check`.
- Stage complete. The screenshot was captured and inspected in the browser session; it is not stored as a repository artifact. No hosted migration was deployed.
