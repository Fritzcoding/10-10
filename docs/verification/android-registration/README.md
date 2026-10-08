# Android registration network check (2026-10-07)

## Result

Reproduced `Failed to fetch` in the Android emulator. The emulator had Wi-Fi and the app had `INTERNET`, but DNS lookup failed for both `google.com` and the configured Supabase host. The production Android bundle contained the correct hosted Supabase URL; this was an emulator DNS issue, not an app URL/configuration issue.

Restarting the Pixel 9 Pro AVD with `-dns-server 8.8.8.8` restored DNS resolution. A subsequent registration request reached Supabase Auth and returned its email validation response for the reserved `example.com` test address. No test account was created. Use a real address to complete an actual signup; that would send/require the account's normal confirmation email.

## Run details

- Emulator: Pixel 9 Pro AVD, Android 17 (API 37), app `app.couple`, `debug` build.
- Build/install: `:app:installDebug` completed successfully.
- Flow: birthday onboarding → Register → submit test address. Before DNS correction the request returned `Failed to fetch`; after correction Supabase returned `Email address "codex-android-qa-20261007@example.com" is invalid`.
- DNS repair command: `emulator -avd <avd-name> -dns-server 8.8.8.8 -no-snapshot-load`.
- Desktop endpoint check: Supabase Auth settings returned HTTP 401 without an API key, confirming the hosted endpoint answered. After restart, emulator `ping` resolved the Supabase hostname to `104.18.38.10` with 0% packet loss.

## Performance snapshot

Short idle-screen `gfxinfo` sample after hiding the keyboard: 20 frames, 7 janky frames (35%), 18 ms median, 32 ms 90th percentile, 113 ms 95th percentile, 1 slow UI-thread frame. `dumpsys meminfo` reported 114,235 KB total PSS. This is a brief emulator sample, not a sustained device benchmark.

## Captured evidence

- `registration-after-dns-fix.png`: Supabase Auth validation response in the app.
- `registration-final.png`: idle registration screen after the request.
- `ui-after-dns-fix.xml` and `ui-idle-final.xml`: Android UI hierarchy snapshots.
- `app-logcat.txt`: app-process log output from the final run.
- `dns-check.txt`: emulator DNS resolution after the AVD restart.
- `gfxinfo-idle-final.txt` and `meminfo-idle-final.txt`: frame and memory snapshots.
- `registration-wait-extended.png`: original reproduced `Failed to fetch` state.

## Limitation

Registration reached Supabase after the DNS repair, but a real account signup was not completed because the user did not provide an email for a confirmation flow. The example address was rejected by Supabase and created no account. The emulator was restarted with explicit DNS and remains available for follow-up testing.
