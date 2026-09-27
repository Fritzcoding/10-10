# send-game-push

This best-effort function accepts `{ recipient_id, title, body, data }`, loads the recipient's `push_subscriptions`, and isolates delivery failures per device. Request creation and persisted in-app notifications do not depend on this function.

Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` as Supabase Function secrets. The VAPID private key is never sent to the client. Replace the provider call in `index.ts` with the Web Push implementation approved for the deployment environment.
