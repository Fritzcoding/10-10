# Stage 15: Shared Love Board Implementation Plan

**Goal:** Add a saved, couple-shared drawing board that accepts touch/pointer and keyboard input, supports undo/clear, and syncs without dropping concurrent partner strokes.

**Architecture:** Store normalized vector strokes in couple-scoped rows rather than uploading a rendered image. Each append is an independent database insert. A per-couple board generation serializes undo/clear; stale writes after a clear fail with an explicit refresh message. Private Realtime broadcasts only a generic refresh signal; clients reload rows through RLS. Render paths as responsive SVG so the vector state remains a compact saved image and can feed a future widget.

**Tech Stack:** Existing React, TypeScript, Supabase Postgres/Realtime, SVG Pointer Events, Node test runner, and pgTAP; no new package.

## Tasks

1. Add RED tests for normalized stroke bounds, point limits, color/width allowlists, pointer normalization, keyboard cursor movement, and stale board revision behavior; then implement the pure helper.
2. Generate a local migration and pgTAP suite for couple board rows, append-only member strokes, serialized generation, author-only undo, shared clear, stale-generation rejection, and unrelated-account isolation. Apply and verify locally.
3. Add a responsive SVG board with pointer/touch drawing, keyboard draw mode, pen selection, undo-my-last-stroke, and clear. Subscribe to couple-authorized refresh signals and show concurrent partner strokes without replacing local state.
4. Run pure tests, full local pgTAP, security advisors, lint, typecheck, build, and diff check. Verify two local authenticated browser accounts draw and receive each other's strokes; inspect mobile screenshots, keyboard controls, and console logs.
5. Update `DOCS.md`, `MEMORY.md`, and the roadmap after acceptance. Keep migration local.

## Verification record (2026-10-07)

- [x] RED/green pure tests: 4 Love Board helper tests pass.
- [x] Local migration and Stage 15 pgTAP: 34 assertions pass; full local suite: 364 checks pass.
- [x] Two authenticated local browser accounts drew and received independent strokes via Realtime; undo preserved the other user's stroke; shared clear removed test artwork.
- [x] Mobile screenshot inspected at 384×832; no visible horizontal overflow. Browser console checks reported no errors.
- [x] Full app checks: 156 Node tests, lint, TypeScript, production build, and diff check pass. Build retains existing chunk-size and ineffective dynamic-import warnings.
- [ ] Physical pointer/touch and Android device checks not performed; keyboard drawing and pointer coordinate normalization are verified.
- [x] Migration remains local; no dependency added.

## Constraints

- New strokes append independently; no client writes a whole board snapshot.
- Clear advances the board generation and deletes the current generation in a transaction. Submissions from an older generation fail clearly.
- Undo removes the current user's most recent stroke only, avoiding silent deletion of a partner's work.
- A shared clear is explicit and confirmed; only couple members can invoke it.
- Coordinates are normalized to a fixed 1000×1000 viewBox. Bound paths and stroke values in both client and database.
- Use SVG as saved vector state. No new Storage bucket, dependency, or hosted migration.

## Review Focus

- RLS and RPC membership checks cover all board and stroke data.
- Append, undo, and clear are serialized on the board row so partner writes cannot vanish silently.
- Touch actions do not scroll while drawing; keyboard users can create a stroke without a pointer.
- Realtime messages contain no drawing payload and are restricted to couple members.
