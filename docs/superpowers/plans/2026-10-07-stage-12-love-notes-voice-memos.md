# Stage 12: Love Notes and Voice Memos

**Goal:** Let either partner save couple-scoped text notes and attach short, playable private voice memos.

**Approach:** Add one RLS-protected `love_notes` table and a private `couple-voice-memos` Storage bucket. Save text first; recording and audio upload happen after the note exists, so microphone, recording, or upload failures preserve the note. Use browser `MediaRecorder` and authenticated Storage downloads, with no new packages.

**Limits:** 2,000 text characters, 60 seconds per recording, 5 MiB per audio file. Accept browser-supported WebM, MP4, or Ogg audio formats. No transcription or AI processing. Migration stays local.

## Tasks

1. [x] Add pure note/audio validation tests and couple/Storage pgTAP authorization tests; observe RED before implementation.
2. [x] Add migration, RLS, private Storage policies, and local replay/pgTAP checks.
3. [x] Add a compact accessible shared-space panel: save/edit/remove text, record/stop, play audio, attach/remove voice; verify failure preserves the saved note.
4. [x] Verify two local authenticated users in separate browser contexts, protected object access for an unrelated user, mobile screenshot/layout, and browser console. Text sync passed; the partner played the private memo through to 0:03 with no console errors. Mobile view inspected at 384×832.
5. [x] Run `npm test`, lint, TypeScript, build, local pgTAP, and `git diff --check`; 143 app tests and the full 281-check local database suite passed. Security advisors found no issues. The database suite passed earlier in this stage while local Supabase was running.

## Review focus

- Only authenticated members of the note's couple can read, change, or delete text and audio.
- Client and bucket reject unsupported, empty, or over-5-MiB audio; metadata bounds recording length to 60 seconds.
- Save the note before requesting microphone access or uploading audio.
- Browser microphone permission may require user interaction; report if it is not already granted.
