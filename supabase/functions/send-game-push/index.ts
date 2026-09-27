import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type GameRequestEvent = { recipient_id: string; title: string; body: string; data?: Record<string, unknown> }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  let event: GameRequestEvent
  try { event = await request.json() as GameRequestEvent } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!event.recipient_id || !event.title || !event.body) return Response.json({ error: 'recipient_id, title, and body are required' }, { status: 400 })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', event.recipient_id)
  if (error) return Response.json({ delivered: 0, error: error.message }, { status: 200 })
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!vapidPublicKey || !vapidPrivateKey) return Response.json({ delivered: 0, skipped: 'VAPID secrets are not configured' })
  // Web Push encryption/signing is deliberately isolated behind this scaffold.
  // Deployments can replace this call with their approved Web Push provider while
  // preserving per-subscription failure isolation and the non-blocking contract.
  let delivered = 0
  for (const subscription of subscriptions ?? []) {
    try {
      await fetch(subscription.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'ttl': '60', 'x-vapid-public-key': vapidPublicKey }, body: JSON.stringify({ title: event.title, body: event.body, data: event.data ?? {} }) })
      delivered += 1
    } catch { /* one unavailable device must not block the others */ }
  }
  return Response.json({ delivered })
})
