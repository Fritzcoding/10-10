# Stage 2: Mobile/PWA Baseline and Pastel UI

> **Execution:** One bite-sized stage after Stage 1 local exit checks. No Stage 3 work.

**Goal:** Make the existing app comfortable on mobile, installable as a web app, and visually calm in white/pastel blue while keeping its gray hub panel treatment.

**Design decisions:** White and soft blue surfaces (`#fbfdff`, `#eaf4fb`), slate-blue text (`#334958`), and a low-contrast cool gray panel (`#edf0f2`). Use the existing system sans stack, left-aligned content, restrained borders, and no decorative gradients/glows. Keep the four actions in one bottom navigation bar with a clear blue selected state. Make the hub content flow with the visible viewport rather than reserving a large fixed top gap.

**Scope:** Configure already-installed `vite-plugin-pwa`; preserve push handling in one root service-worker registration; precache only the static shell and assets; never cache Supabase/auth responses. Add safe-area, dynamic viewport, keyboard resize, tap, focus, and minimum input-size behavior. Leave actual Android installation and physical keyboard validation for the user's device.

**Verification:** Add tests first for the absent manifest/PWA settings and known mobile navigation mismatch; run them red before implementation. Then run Node tests, lint, typecheck, build, diff checks, inspect browser DOM/console and screenshot at desktop, narrow portrait, and landscape viewports. No hosted schema or two-account changes in this stage.

## Tasks

### 1. Regression tests

- [x] Assert manifest name/display/colors and install icon declarations.
- [x] Assert existing PWA config keeps push worker and static-only caching policy.
- [x] Assert four-column nav, safe-area spacing, 16px form fields, and mobile viewport metadata.
- [x] Run the new tests red before implementation; the missing manifest/PWA/mobile styles caused expected failures.

### 2. Mobile shell and PWA

- [x] Configure `VitePWA` with an explicit manifest, icons, static shell precache, no runtime caching, and automatic build update handling.
- [x] Merge the existing push event handler through Workbox-generated `importScripts`; remove the competing manual root-scope registration.
- [x] Set viewport-fit and light theme color; apply safe areas, 100dvh, keyboard resize metadata, and touch/focus defaults.
- [x] Fix the nav column count and spacing; avoid sticky hover on touch and keep tap targets at least 44px.

### 3. Visual pass

- [x] Restyle the signed-in hub and login screen with white background and pale blue interactive surfaces; preserve a cool-gray hub panel.
- [x] Improve phone flow, text contrast, content spacing, and landscape behavior without changing feature flows.
- [ ] Inspect browser rendering, DOM, and console at desktop and mobile-sized viewports; capture screenshots. The available browser surface inventory was empty and no local browser executable is installed, so this could not be performed here.

### 4. Exit and record

- [x] Run Node tests (71), lint, typecheck, and build; global diff check reports only the known pre-existing `.gitignore:86` blank line.
- [x] Update DOCS, roadmap, and MEMORY with implementation progress and remaining verification.
- [ ] Android Chrome install/update/keyboard verification on Galaxy S25 remains pending.

## Exit criteria

The PWA manifest and generated service worker build correctly, push handler stays registered, only the static app shell is cached, gray panel styling and responsive rules are implemented, and automated checks pass. The stage remains open until browser DOM/console/screenshot inspection and physical Android install/update/keyboard behavior are verified.
