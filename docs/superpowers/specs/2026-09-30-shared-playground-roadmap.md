# Shared Playground: Audit and Implementation Roadmap

**Status:** Product direction approved for staged execution. Stage 0 baseline is complete. Stage 1 authorization foundation is implemented and locally verified; Stage 2 is in progress.

## Goal

Scale the existing private couples app into a personal shared playground for two people, adding games, activities, and shared relationship features in small, independently reviewable stages. Keep the existing React/Vite/Supabase application, protect private data at the database layer, and make the web app mobile/PWA-ready without starting native development.

## Current Repository Audit

### Stack and workflow

- React 19, TypeScript, Vite; static web client with bespoke CSS and `lucide-react`.
- Supabase Auth, Postgres, Realtime, and an Edge Function. The browser talks directly to Supabase; no app server or deployment-host configuration is present in the repository.
- React local state; no routing library. Tailwind is installed but not used in the inspected UI.
- Ten Node test files cover pure logic for Tic-Tac-Toe, requests, sessions, profile/social behavior, and notifications. Scripts exist for tests, lint, build/type checking, dev, and preview.
- `vite-plugin-pwa` is already installed but not configured. A push service-worker file exists, but no manifest or service-worker registration was found.
- The tracked migrations do not provide a complete initial schema for all referenced tables. Deployed schema state and migration history must be reconciled before adding database features.
- The working tree was already modified before this roadmap was written. Existing changes must be preserved.

### Existing product functionality

- Email/password registration and login, profile initialization, display name, avatar URL, and partner profile fields.
- Friend discovery by UID/email, friend and partner requests, direct chat, and a partner status indicator.
- Tic-Tac-Toe bot play and friend requests that create persistent remote game sessions; Realtime Presence and session/request updates; local two-account pairing harness.
- A game request notification table/banner and an Edge Function scaffold for push.
- Responsive CSS exists in places, including `100svh`, focus treatment, and some reduced-motion behavior. Device-level responsive behavior has not been verified.

### Partial or missing product functionality

- Multiplayer only supports Tic-Tac-Toe. A separate legacy mode uses a fixed broadcast channel. No shared reusable game catalog/session framework exists.
- Request expiry has a UI countdown; there is no game timer framework. Game sessions persist, but there is no history view or general activity timeline.
- Notification persistence is modeled, but tracked request RPCs do not create notification rows. Push delivery is a placeholder, not a verified Web Push implementation.
- Profile avatar URLs exist; upload/storage does not. No questions, drawing game, memories, bucket list, inside jokes, daily content, scheduled surprises, scoring, or persistent achievements were found.
- The current bottom navigation renders four tabs while its CSS declares three grid columns.

## Privacy and Security Requirements

1. Reconcile the complete schema and deployed migrations before writing new migrations.
2. Establish a canonical two-member couple record as the authorization scope for shared data. Do not rely on two independently updated profile fields as the durable relationship invariant.
3. Narrow authenticated profile discovery: the current tracked profile policy allows any authenticated account to read all profiles, including email.
4. Restrict chat recipients to an intended relationship; current tracked message insertion checks sender ownership but does not require a friendship/partner relationship.
5. Replace browser-authoritative game updates with atomic, server-validated state transitions. The current session update policy allows a participant to write arbitrary session state.
6. Retire or secure the fixed legacy game broadcast channel with participant-specific private Realtime authorization before carrying private game content.
7. Keep hidden game answers and submissions private until both players submit or a server deadline triggers reveal.
8. Treat push as optional delivery. Keep persisted in-app state authoritative; authorize recipient and event server-side and implement real Web Push before enabling delivery.
9. Do not access external private conversations or import users' chat histories. Memories, inside jokes, and prompts are entered by the users.

## Recommended Architecture

Keep React, Vite, Supabase, and direct-to-Supabase access. Do not add a general game engine or a separate backend server.

- Add a small static game catalog for IDs, labels, duration estimates, and capabilities.
- Keep each game's rules/UI in its own module and test rules as pure TypeScript functions.
- Share only session lifecycle, participant identity, authorized realtime subscription, deadline handling, and server-validated submission.
- Use a small common game-session record with game type, two participants, status, optional round/deadline, and game-specific state. Use participant-owned submission rows when answers or drawings must be hidden. Add generic fields only when a real game needs them.
- Start tiny games as local-first modules; add shared head-to-head sessions only where they improve play.
- Use a couple-scoped RLS policy for timeline, question answers, bucket items, jokes, surprises, and stored photos.

## Mobile and PWA Strategy

- Keep the web product and shared React code; do not begin native development now.
- Configure the already-installed PWA plugin, add/link a manifest and icons, register the service worker, and choose an update policy. Cache the static shell/content only; do not cache private data by default.
- Verify narrow portrait, landscape, safe areas, on-screen keyboard, and backgrounded timers on Android Chrome. Treat target dimensions as CSS viewport sizes, not the physical panel's pixel count.
- Use touch-sized controls and pointer events. Scope touch-scroll prevention to the drawing canvas only.
- Use a file input with image capture as an optional camera path and a regular file-picker fallback. Upload only after explicit user action, to private couple-scoped storage.
- Use server deadlines for timers so backgrounding does not extend rounds.
- Keep in-app notifications as the fallback. iOS web push has install/context and user-gesture requirements; test device/platform support before promising it.
- Consider a WebView wrapper only if app-store distribution becomes a real requirement.

## Content and Dependency Decisions

- **Question cards:** No clearly suitable, rights-verified relationship-question dataset was established during the audit. Do not copy commercial decks or unlabeled lists. Start with a small original seed plus an add-question path; any bulk generated content should be reviewed and have provenance recorded.
- **Open Trivia Database:** [API and license](https://opentdb.com/api_config.php). CC BY-SA 4.0 data; commercial use is permitted, attribution is required, and adapted data has share-alike obligations. It is suitable for a later trivia game, not relationship prompts. Runtime API integration is easy but unnecessary for this phase.
- **Kovah Taboo-Data:** [Repository and GPL-3.0 license](https://github.com/Kovah/Taboo-Data). Private/commercial use is allowed under GPL terms, but redistribution may create source-sharing obligations. Do not bundle until the distribution model is reviewed; prefer original/user-added content or an appropriately licensed word list.
- **React Konva/Konva:** [React bindings and MIT license](https://github.com/konvajs/react-konva). Commercial/private use allowed with license notice; provides a React canvas scene graph and image layers. Moderate integration, web-only. Use only if the drawing game needs richer scene/image support; native Canvas is enough for a simple first brush.
- **vite-plugin-pwa:** [Project and MIT license](https://github.com/vite-pwa/vite-plugin-pwa); already installed. Configure it rather than adding another PWA package.
- **Timers and tiny games:** Browser APIs and a few tested pure functions are enough; no timer/game framework dependency is recommended.
- **Supabase Realtime/Storage/Cron:** Reuse the existing platform. Scope data with RLS. Cron can support scheduled surprises after plan/configuration is confirmed.

## Minimal Data Model Evolution

Only introduce these as their phase begins:

1. Canonical two-member couple record and membership invariants.
2. Generalized game request/session type, server-validated move/submission operations, and optional deadline/revision fields.
3. Private game submissions for hidden answers and drawing entries.
4. Question records with category and source/license/provenance; couple-authored records attached to the couple.
5. Couple-scoped bucket-list items, inside jokes, and scheduled surprises.
6. A small timeline table for selected completed milestones, not a log of every interaction.
7. Private Storage objects for uploaded images, with policies scoped to couple membership.

Do not add score, achievement, card, round, analytics, or generic event tables until a concrete feature requires them.

## Staged TODO Roadmap

Each stage is a separate implementation/review cycle. Finish and verify one stage before starting the next; do not implement the roadmap as one batch. Before each coding stage, write a stage-specific bite-sized task plan and regression tests. Preserve existing working behavior. Do not claim live two-account Supabase verification without two authenticated accounts and required migrations.

### Stage 0 — Baseline and migration reconciliation

**Current status:** Complete. The user confirmed SQL was applied manually, so the hosted schema is authoritative. The repository has a raw public-schema baseline plus the custom `auth.users` trigger and `supabase_realtime` publication memberships. All nine previous SQL files were moved byte-for-byte to `supabase/migrations-archive/pre-baseline-manual-sql/` and hash-verified. A clean local reset passed, `db diff --linked` reported no changes, and `migration repair` recorded only baseline version `20260930161439` in hosted migration history. No application SQL was pushed.

- [x] Inventory the hosted public schema and migration history without exposing credentials. Seven public tables, 16 policies, four functions, and an empty hosted migration list were confirmed. Local snapshot replay succeeded; app migrations fail when combined with the snapshot.
- [x] Establish a reproducible repository baseline and reconcile the overlapping feature migrations/policies. Local `db reset` passed; `db diff --linked` reported no schema changes; the single active baseline matches hosted history.
- [x] Record tests, lint, typecheck/build, and diff-check results; note browser/configuration limits. Tests (61), lint, typecheck, and build pass. `git diff --check` reports a pre-existing blank line at `.gitignore:86`; `db push --dry-run` failed temporary-role password authentication (`cli_login_postgres`), and the CLI suggests checking `SUPABASE_DB_PASSWORD`. Migration list is matched. No two-account test was performed.
- **Exit:** Current deployed data/schema can be migrated reproducibly without guessing. Met.

### Stage 1 — Relationship and authorization foundation

- [x] Define the canonical two-member couple record and safe migration/backfill from reciprocal profile fields.
- [x] Restrict profile discovery and chat access to the intended product scope.
- [x] Add transactional pairing and server-validated game-session state transitions.
- [x] Secure/retire the legacy fixed Realtime channel.
- [x] **Exit (local):** 32 pgTAP checks prove unrelated users cannot read shared content, arbitrary recipients cannot receive chat, and players cannot submit illegal moves; 67 app tests, lint, typecheck, and build pass. The hosted Stage 1 migration remains unapplied; no real two-account test was performed. Global `git diff --check` reports the previously documented `.gitignore:86` blank line only.

### Stage 2 — Mobile/PWA baseline

- [ ] Fix responsive navigation columns, safe-area spacing, viewport/keyboard layout, and touch target issues; apply the approved white/light-blue visual theme while keeping gray panels.
- [ ] Configure the installed PWA plugin, manifest, install icons, service-worker registration, and update strategy while retaining push handling and excluding private Supabase data from caches.
- [ ] Verify the app shell and layouts in a browser; install/update and keyboard behavior on Android Chrome still require the user's phone.

**Progress (2026-10-01):** PWA config, manifest/icons, static-only app-shell precache, merged push handling, viewport/safe-area behavior, and the white/pastel-blue UI with gray panels are implemented. 71 tests, lint, typecheck, and build pass. Browser DOM/console/screenshots could not be verified because no browser surface/executable is available; Android install/update/keyboard behavior is also pending. Keep Stage 2 open.
- **Exit:** Installed PWA shell works online and does not cache private server data.

### Stage 3 — Shared game/content seam

- [ ] Generalize Tic-Tac-Toe-specific catalog/request/session types without changing its working flows.
- [ ] Add common metadata, lifecycle, server deadline, and authorized subscription patterns.
- [ ] Add private submissions and reveal rules tested at the database layer.
- **Exit:** Tic-Tac-Toe still works and a second small hidden-answer game can use the seam without duplicating authorization/lifecycle.

### Stage 4 — First conversation games

- [ ] Question Card Game using categorized, provenance-aware prompts and couple-authored questions.
- [ ] Who’s More Likely with independent private answers and simultaneous reveal.
- [ ] Lie Detector with an initial 2-truths/1-lie mode and room for variants.
- [ ] Describe Without Saying It with a licensed/original word source, optional forbidden words, and a deadline.
- **Exit:** Each game has pure rule tests and a two-account privacy/reveal flow.

### Stage 5 — Tiny games and Bored Mode

- [ ] Add a first varied set of local-first, phone-friendly games from the approved list.
- [ ] Add duration and recency metadata to the catalog.
- [ ] Recommend by available time, availability, and recent play; avoid static random-only selection.
- **Exit:** Recommendations are explainable and avoid repeatedly suggesting recently played games when alternatives fit.

### Stage 6 — Shared relationship layer

- [ ] Daily question with hidden independent answers and reveal after both respond.
- [ ] Simple shared bucket list with completion.
- [ ] Manually entered inside-joke collection.
- [ ] Timeline showing selected completed games and shared milestones.
- **Exit:** All records are couple-scoped by RLS and usable by both accounts.

### Stage 7 — Drawing and images

- [ ] Canvas drawing, presets (15s, 30s, 1m, 3m, 5m), practical custom time, submit/reveal/compare.
- [ ] Add optional reference image and photo/file upload to private storage; allow drawing over image if the chosen canvas implementation supports it cleanly.
- **Exit:** Touch drawing and authorized image access work on Android Chrome; submissions remain hidden until reveal.

### Stage 8 — Surprise delivery

- [ ] Schedule a message/question/challenge/photo/memory/game/activity with an availability time.
- [ ] Show available surprises in-app first.
- [ ] Complete authenticated Web Push delivery only after secure recipient validation, subscription lifecycle, real protocol implementation, and platform testing.
- **Exit:** Surprise visibility is server-time controlled; push failure never loses or prematurely reveals the surprise.

## Test and Verification Contract

- Pure game logic: Node tests for moves, turns, timers/deadlines, duplicate input, scoring/reveal rules, and completion.
- Database: local/integration checks for RLS, participant ownership, legal atomic transitions, two-person invariants, hidden submissions, and storage policy.
- Realtime/auth: two authenticated sessions for remote flows; use the existing local harness only for UI work, not as proof of database security.
- UI: browser inspection, console check, screenshots, keyboard/touch checks, reduced motion/focus, and mobile viewport checks for changed user-facing flows.
- Final stage checks per repository instructions: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`. Report external migration/account/device blockers plainly.
- Update `MEMORY.md` after each completed major stage. Update `DOCS.md` and its stage checkbox only after the corresponding stage passes the repository's required checks.

## Known Risks and Explicitly Deferred Scope

- Existing profile-wide email discovery, unrestricted chat-recipient policy, permissive session updates, and fixed game channel must be reviewed before adding intimate shared records.
- The deployed schema/migration history is not fully represented in this checkout.
- Push delivery, file uploads, and phone-specific behavior require real environment/device verification.
- Context Collapse is rejected: do not access private conversations from other services. Use deliberate manual memory entry only.
- Co-op Escape Room is deferred. Procedural/template-driven puzzle generation is a future possibility, not part of these stages.
