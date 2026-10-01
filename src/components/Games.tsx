import { ArrowLeft, Gamepad2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import TicTacToe from './games/TicTacToe'
import RemoteTicTacToe from './games/RemoteTicTacToe'
import { createGameRequest, getActiveGameRequests, mergeGameRequests, type GameRequest } from '../lib/gameRequests'
import { friendDisplayName, groupFriendsByPresence, onlineFriendNames, type FriendProfile } from '../lib/gamePresence'
import { type GameSession } from '../lib/gameSessions'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import './Games.css'

type GamesProps = { userId?: string; onlineUserIds: ReadonlySet<string>; activeSession?: GameSession | null; onSessionReady?: (session: GameSession) => void }

function Games({ userId: authenticatedUserId, onlineUserIds, activeSession, onSessionReady }: GamesProps) {
  const [activeGame, setActiveGame] = useState<'tic-tac-toe' | null>(null)
  const [mode, setMode] = useState<'directory' | 'mode-picker' | 'friend-picker' | 'bot' | 'remote'>('directory')
  const userId = authenticatedUserId
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [requests, setRequests] = useState<GameRequest[]>([])
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => new Date())
  const remoteSession = activeSession

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!supabase || !userId) return
    const client = supabase
    void client.rpc('get_couple_partner').then(({ data, error }) => {
      if (error) { setMessage(formatSupabaseDataError(error)); return }
      const profiles = Array.isArray(data) ? data : []
      setFriends(profiles.map((profile) => ({ ...profile, display_name: friendDisplayName(profile), avatar_url: profile.avatar_url ?? null })))
    })
  }, [userId])

  useEffect(() => {
    if (!supabase || !userId) return
    const client = supabase
    const loadRequests = async () => {
      const { data } = await client.from('game_requests').select('*').or(`requester_id.eq.${userId},recipient_id.eq.${userId}`).order('created_at', { ascending: false })
      setRequests((data ?? []) as GameRequest[])
    }
    void loadRequests()
    const channel = client.channel(`games-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_requests' }, () => void loadRequests())
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [onSessionReady, userId])

  const sendRequest = async (friend: FriendProfile) => {
    setMessage('')
    try {
      const request = await createGameRequest(friend.id)
      setRequests((current) => mergeGameRequests(current, [request]))
      setMessage(request.wasExisting ? `Already sent to ${friend.display_name}. It is still waiting for them.` : `Request sent to ${friend.display_name}.`)
    } catch (error) {
      setMessage(formatSupabaseDataError(error as { message?: string | null }))
    }
  }

  if (activeGame === 'tic-tac-toe' || remoteSession) {
    const grouped = groupFriendsByPresence(friends, onlineUserIds)
    return (
      <div className="games-view">
        <button className="games-view__back" type="button" onClick={() => { setActiveGame(null); setMode('directory') }}><ArrowLeft size={17} aria-hidden="true" />All games</button>
        {remoteSession && <RemoteTicTacToe session={remoteSession} userId={userId ?? ''} />}
        {!remoteSession && mode === 'mode-picker' && <div className="games-mode-picker"><h2>How do you want to play?</h2><button type="button" onClick={() => setMode('bot')}>Play against Bot</button><button type="button" onClick={() => setMode('friend-picker')}>Play with a Friend</button></div>}
        {!remoteSession && mode === 'friend-picker' && <div className="games-mode-picker"><h2>Choose a friend</h2>{grouped.online.length > 0 && <p className="games-online-summary" aria-live="polite">Online now: {onlineFriendNames(friends, onlineUserIds).join(', ')}</p>}{[...grouped.online, ...grouped.offline].map((friend) => {
          const existing = getActiveGameRequests(requests, now).find((request) => request.requester_id === userId && request.recipient_id === friend.id)
          return <div className="games-friend-row" key={friend.id}><div><strong>{friend.display_name}</strong><small>{onlineUserIds.has(friend.id) ? '● Online' : '○ Offline'}</small></div><button type="button" disabled={Boolean(existing)} onClick={() => void sendRequest(friend)}>{existing ? 'Request sent' : 'Send request'}</button></div>
        })}{friends.length === 0 && <p>Pair with your partner before starting a shared game.</p>}{message && <p className="games-message" aria-live="polite">{message}</p>}</div>}
        {!remoteSession && mode === 'bot' && <TicTacToe mode="bot" />}
      </div>
    )
  }

  return <div className="games-directory"><div className="games-directory__intro"><p className="hub-panel__eyebrow">Play together</p><h2>Pick a little game.</h2><p>Choose something quick and make a new memory together.</p></div><div className="games-grid"><button className="game-card" type="button" onClick={() => { setActiveGame('tic-tac-toe'); setMode(remoteSession ? 'remote' : 'mode-picker') }}><span className="game-card__icon"><Gamepad2 size={24} aria-hidden="true" /></span><span className="game-card__copy"><strong>Tic-Tac-Toe</strong><span>Classic three-in-a-row</span></span><span className="game-card__arrow" aria-hidden="true">→</span></button></div></div>
}

export default Games
