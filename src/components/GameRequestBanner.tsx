import { useEffect, useMemo, useState } from 'react'
import { acceptGameRequest, declineGameRequest, type GameRequest } from '../lib/gameRequests'
import { isExpiredNotification, type GameNotification } from '../lib/gameNotifications'
import { buildGameRequestBannerModel, formatRemainingTime } from '../lib/gameRequestBanner'
import { supabase } from '../lib/supabase'
import './GameRequestBanner.css'

export type GameRequestBannerProps = {
  userId?: string
  requests?: GameRequest[]
  notifications?: GameNotification[]
  onAccept?: (requestId: string) => void
  onDecline?: (requestId: string) => void
  onDismissNotification?: (notificationId: string) => void
}

function GameRequestBanner({ userId, requests: initialRequests = [], notifications: initialNotifications = [], onAccept, onDecline, onDismissNotification }: GameRequestBannerProps) {
  const [requests, setRequests] = useState(initialRequests)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!userId || !supabase) return
    const client = supabase
    let active = true
    const load = async () => {
      const [{ data: requestRows }, { data: notificationRows }] = await Promise.all([
        client.from('game_requests').select('*').or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
        client.from('notifications').select('*').eq('user_id', userId).eq('kind', 'game_request').order('created_at', { ascending: false }),
      ])
      if (active) { setRequests((requestRows ?? []) as GameRequest[]); setNotifications((notificationRows ?? []) as GameNotification[]) }
    }
    void load()
    const channel = client.channel(`game-requests-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'game_requests' }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => void load())
    void channel.subscribe()
    return () => { active = false; void client.removeChannel(channel) }
  }, [userId])

  const model = useMemo(() => buildGameRequestBannerModel(requests, notifications, now, userId ?? ''), [now, notifications, requests, userId])
  if (!userId || (model.requests.length === 0 && model.unreadCount === 0)) return null

  const handleAccept = async (requestId: string) => { await acceptGameRequest(requestId); onAccept?.(requestId) }
  const handleDecline = async (requestId: string) => { await declineGameRequest(requestId); onDecline?.(requestId) }
  return <section className="game-request-banner" aria-label="Game requests">
    <div className="game-request-banner__heading"><strong>Game requests</strong>{model.unreadCount > 0 && <span>{model.unreadCount} unread</span>}</div>
    {model.requests.map(({ request, remainingSeconds }) => <article className="game-request-banner__request" key={request.id}>
      <div><strong>A friend wants to play Tic-Tac-Toe</strong><small>Expires in {formatRemainingTime(remainingSeconds)}</small></div>
      <div className="game-request-banner__actions"><button type="button" onClick={() => void handleAccept(request.id)}>Accept</button><button type="button" onClick={() => void handleDecline(request.id)}>Decline</button></div>
    </article>)}
    {notifications.filter((notification) => !notification.read_at && !isExpiredNotification(notification, now)).map((notification) => <button className="game-request-banner__notification" key={notification.id} type="button" onClick={() => { setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item)); onDismissNotification?.(notification.id) }}>{notification.title}: {notification.body}</button>)}
  </section>
}

export default GameRequestBanner
