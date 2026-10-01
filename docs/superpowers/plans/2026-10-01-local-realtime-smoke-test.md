# Local Realtime Smoke Test Implementation Plan

> **For agentic workers:** Execute this plan task by task. Keep the scope local; do not write to hosted Supabase.

**Goal:** Make the verified two-account game request and realtime flow repeatable with one local Playwright command.

**Architecture:** Use the existing `playwright` devDependency and a dedicated Playwright config/spec outside `tests/*.test.ts`. The test registers disposable users through the app in two isolated browser contexts, pairs them in the local Supabase database, exercises requests and moves, captures artifacts, and cleans up its local rows.

**Tech Stack:** Playwright 1.63, Chromium, React/Vite, local Supabase.

**Spec:** `docs/verification/remote-game/README.md`; current project state in `MEMORY.md` and constraints in `DOCS.md`.

## Global Constraints

- Target only `127.0.0.1` and local Supabase; never use the linked/hosted database or credentials.
- Reuse the existing Playwright dependency; do not add packages.
- Preserve the user-facing sign-up, request, accept, and move paths in the test.
- Always remove test users, couple rows, requests, and sessions, including after failures.
- Do not apply, repair, or push hosted migrations. Report the hosted/local difference for a separate approval decision.

## Review Focus

- Realtime request event arrives without page reload; wait on visible state with a bounded timeout.
- Duplicate send stays visibly blocked and does not create another pending request.
- Accept opens the same session for both users; each player's move appears in the other context.
- Teardown removes only rows belonging to the generated test users, even when setup or assertions fail.
- Browser console errors fail the test; unrelated existing build warnings do not.

---

### Task 1: Add a separate Playwright smoke-test entry point

**Files:**
- Create: `playwright.config.ts`
- Modify: `package.json`
- Test: `e2e/game-request-realtime.spec.ts`

**Interfaces:**
- Produces: `npm run test:e2e` runs the dedicated E2E spec against Vite at `http://127.0.0.1:5173`.
- Local Supabase is a prerequisite started with `npx supabase start`; the test must fail with a clear message if local Supabase is unavailable.

- [ ] Write a minimal failing Playwright spec that opens the app and reaches its onboarding screen in two isolated contexts.
- [ ] Run `npm run test:e2e` and confirm the failure is for the missing config/script/spec behavior, not browser installation.
- [ ] Add the config and `test:e2e` script using the installed Playwright version and Chromium. Configure Vite `webServer`, a phone-sized viewport, and test artifacts under Playwright's ignored output directory.
- [ ] Run the smoke spec and confirm both contexts render the onboarding screen.

### Task 2: Create and clean up local test accounts

**Files:**
- Modify: `e2e/game-request-realtime.spec.ts`
- Create only if needed: `e2e/localTestAccounts.ts`

**Interfaces:**
- Test setup creates two unique `example.test` users through the app's Register flow, then inserts one local couple/membership fixture using `npx supabase db query --local --file <temporary SQL file>`.
- Teardown accepts only the two generated account IDs/emails and deletes their related local rows. Never print auth tokens or passwords.

- [ ] Add a failing assertion that both accounts can register and reach the Hub.
- [ ] Run it and verify the local setup prerequisite and expected Hub assertion are exercised.
- [ ] Implement fixture setup and `finally`-safe teardown; keep generated SQL in the OS temp directory and restrict cleanup predicates to the generated test identities.
- [ ] Run the registration test twice to prove unique identities and cleanup leave no `qa-*` users or empty test couples behind.

### Task 3: Automate the request-to-shared-game flow

**Files:**
- Modify: `e2e/game-request-realtime.spec.ts`
- Update: `docs/verification/remote-game/README.md`

**Interfaces:**
- One test uses the sender and receiver contexts created in Task 2; no test-only production routes or app code are added.

- [ ] Assert sender can start Tic-Tac-Toe, sees the selected partner, and sees “Request sent”. Assert the request action is disabled after send.
- [ ] Without reloading the receiver, wait for the incoming request banner and assert sender identity plus Accept/Decline controls.
- [ ] Accept and assert both contexts open Tic-Tac-Toe. Submit one legal move per player and wait for each move to appear in the other context.
- [ ] Capture sent, received, and shared-game screenshots in Playwright output. Collect console errors and fail on any page error or console error.
- [ ] Run the test repeatedly and confirm it passes from clean local data; cleanup runs after both passing and deliberately failing assertions.
- [ ] Record the one-command setup/run steps and the fact that hosted behavior was not tested.

### Task 4: Read-only hosted readiness report

**Files:**
- Update: `docs/verification/remote-game/README.md`

- [ ] Run `npx supabase migration list --linked` and read-only catalog/RPC checks only; do not run `db push`, `migration repair`, SQL writes, or alter hosted settings.
- [ ] Compare hosted migration/RPC state with the local migration list and document the exact blockers to hosted two-account verification.
- [ ] Stop for explicit user approval before any hosted migration or data change.

## Completion Checks

Run `npm run test:e2e`, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`. The local E2E command must pass with two separate browser contexts, no reload between send and receive, shared moves in both directions, screenshots saved, no console errors, and zero remaining test accounts. Hosted work is not part of this plan.
