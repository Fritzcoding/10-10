# Stage 4 — Conversation Games

## Task plan

1. Add the Stage 4 game/catalog types and pure rules first; prove invalid input, role rotation, guess normalization, and reveal timing with Node tests.
2. Add one local migration for prompt provenance/couple ownership, two-round session state, and validated RPCs; extend pgTAP coverage for RLS, hidden submissions, legal transitions, and deadlines.
3. Add the four game flows to Games and Hub using existing requests, session routing, and Realtime; leave Stages 5–8 internal-only metadata.
4. Verify automated checks, local database reset/pgTAP, two-account browser flows, visible mobile layout, and console; then update DOCS.md and MEMORY.md.

## Decisions

- Prompt games use original seed content; couple-authored questions are limited to Question Cards.
- Question Cards and Who’s More Likely reveal after both partners submit.
- Lie Detector and Describe Without Saying It each have two rounds, alternating creator/guesser roles. Describe uses a 60-second server deadline and trimmed, case-insensitive exact guesses.
- No future-stage screens, handlers, or database models; no hosted migration deployment.
