import { useEffect, useMemo, useState } from 'react'
import { acceptGameRequest, declineGameRequest, type GameRequest } from '../lib/gameRequests'
import { isExpiredNotification, type GameNotification } from '../lib/gameNotifications'
import { buildGameRequestBannerModel, formatRemainingTime, requestActionLabel } from '../lib/gameRequestBanner'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import './GameRequestBanner.css'

export type GameRequestBannerProps = {
  userId?: string
  requests?: GameRequest[]
  notifications?: GameNotification[]
  onAccept?: (requestId: string, sessionId: string) => void
  onDecline?: (requestId: string) => void
  onDismissNotification?: (notificationId: string) => void
}

function GameRequestBanner({ userId, requests: initialRequests = [], notifications: initialNotifications = [], onAccept, onDecline, onDismissNotification }: GameRequestBannerProps) {
  const [requests, setRequests] = useState(initialRequests)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [now, setNow] = useState(() => new Date())
  const [profileNames, setProfileNames] = useState<Record<string, string>>({})
  const [pendingAction, setPendingAction] = useState<{ requestId: string; action: 'accept' | 'decline' } | null>(null)
  const [actionError, setActionError] = useState('')

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
      const requesterIds = [...new Set((requestRows ?? []).filter((row) => row.recipient_id === userId).map((row) => row.requester_id))]
      if (requesterIds.length) {
        const { data: profiles } = await client.from('profiles').select('id, display_name').in('id', requesterIds)
        if (active) setProfileNames(Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile.display_name ?? 'A friend'])))
      }
    }
    void load()
    const channel = client.channel(`game-requests-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'game_requests' }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => void load())
    void channel.subscribe()
    return () => { active = false; void client.removeChannel(channel) }
  }, [userId])

  const model = useMemo(() => buildGameRequestBannerModel(requests, notifications, now, userId ?? ''), [now, notifications, requests, userId])
  if (!userId || (model.requests.length === 0 && model.unreadCount === 0)) return null

  const handleAccept = async (requestId: string) => {
    setPendingAction({ requestId, action: 'accept' })
    setActionError('')
    try {
      const result = await acceptGameRequest(requestId)
      setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status: 'accepted' } : request))
      onAccept?.(requestId, result.session_id)
    } catch (error) {
      setActionError(formatSupabaseDataError(error as { message?: string | null }))
    } finally {
      setPendingAction(null)
    }
  }
  const handleDecline = async (requestId: string) => {
    setPendingAction({ requestId, action: 'decline' })
    setActionError('')
    try {
      await declineGameRequest(requestId)
      setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status: 'declined' } : request))
      onDecline?.(requestId)
    } catch (error) {
      setActionError(formatSupabaseDataError(error as { message?: string | null }))
    } finally {
      setPendingAction(null)
    }
  }
  return <section className="game-request-banner" aria-label="Game requests">
    <div className="game-request-banner__heading"><strong>Game requests</strong>{model.unreadCount > 0 && <span>{model.unreadCount} unread</span>}</div>
    {model.requests.map(({ request, remainingSeconds }) => <article className="game-request-banner__request" key={request.id}>
      <div><strong>{profileNames[request.requester_id] ?? 'A friend'} wants to play Tic-Tac-Toe</strong><small>Request from {profileNames[request.requester_id] ?? 'a friend'} · Expires in {formatRemainingTime(remainingSeconds)}</small></div>
      <div className="game-request-banner__actions"><button type="button" disabled={Boolean(pendingAction)} onClick={() => void handleAccept(request.id)}>{requestActionLabel('accept', pendingAction?.requestId === request.id && pendingAction.action === 'accept')}</button><button type="button" disabled={Boolean(pendingAction)} onClick={() => void handleDecline(request.id)}>{requestActionLabel('decline', pendingAction?.requestId === request.id && pendingAction.action === 'decline')}</button></div>
    </article>)}
    {actionError && <p className="game-request-banner__error" role="alert">{actionError}</p>}
    {notifications.filter((notification) => !notification.read_at && !isExpiredNotification(notification, now)).map((notification) => <button className="game-request-banner__notification" key={notification.id} type="button" onClick={() => { setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item)); onDismissNotification?.(notification.id) }}>{notification.title}: {notification.body}</button>)}
  </section>
}

export default GameRequestBanner
