import { ArrowLeft, Gamepad2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import TicTacToe from './games/TicTacToe'
import RemoteTicTacToe from './games/RemoteTicTacToe'
import ConversationGame from './games/ConversationGame'
import { GAME_CATALOG, type GameId } from '../lib/gameCatalog'
import { createGameRequest, getActiveGameRequests, mergeGameRequests, type GameRequest } from '../lib/gameRequests'
import { friendDisplayName, groupFriendsByPresence, onlineFriendNames, type FriendProfile } from '../lib/gamePresence'
import { type GameSession } from '../lib/gameSessions'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import './Games.css'

type GamesProps = { userId?: string; onlineUserIds: ReadonlySet<string>; activeSession?: GameSession | null; onSessionExit: () => void }
type GameMode = 'directory' | 'mode-picker' | 'friend-picker' | 'bot' | 'remote'
const PLAYABLE_GAMES = GAME_CATALOG.filter(({ id }) => id !== 'would-you-rather')

function Games({ userId, onlineUserIds, activeSession, onSessionExit }: GamesProps) {
  const [activeGame, setActiveGame] = useState<GameId | null>(null)
  const [mode, setMode] = useState<GameMode>('directory')
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [requests, setRequests] = useState<GameRequest[]>([])
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => new Date())
  const remoteSession = activeSession ?? null

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!supabase || !userId) return
    void supabase.rpc('get_couple_partner').then(({ data, error }) => {
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
    const refresh = () => { void loadRequests() }
    const channel = client.channel(`games-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'game_requests' }, refresh).subscribe((status) => { if (status === 'SUBSCRIBED') refresh() })
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('focus', refresh); void client.removeChannel(channel) }
  }, [userId])

  const sendRequest = async (friend: FriendProfile) => {
    if (!activeGame) return
    setMessage('')
    try {
      const request = await createGameRequest(friend.id, activeGame)
      setRequests((current) => mergeGameRequests(current, [request]))
      setMessage(request.wasExisting ? `Already sent to ${friend.display_name}. It is still waiting for them.` : `Request sent to ${friend.display_name}.`)
    } catch (error) {
      setMessage(formatSupabaseDataError(error as { message?: string | null }))
    }
  }

  const exitGame = () => { setActiveGame(null); setMode('directory'); onSessionExit() }
  const grouped = groupFriendsByPresence(friends, onlineUserIds)
  const selectedGame = activeGame ? GAME_CATALOG.find((game) => game.id === activeGame) : null

  if (remoteSession) {
    return <div className="games-view">
      <button className="games-view__back" type="button" onClick={exitGame}><ArrowLeft size={17} aria-hidden="true" />All games</button>
      {remoteSession.game_type === 'tic-tac-toe'
        ? <RemoteTicTacToe session={remoteSession} userId={userId ?? ''} />
        : <ConversationGame session={remoteSession} userId={userId ?? ''} onExit={exitGame} />}
    </div>
  }

  if (activeGame === 'tic-tac-toe' && (mode === 'mode-picker' || mode === 'bot')) {
    return <div className="games-view">
      <button className="games-view__back" type="button" onClick={() => { setActiveGame(null); setMode('directory') }}><ArrowLeft size={17} aria-hidden="true" />All games</button>
      {mode === 'mode-picker' && <div className="games-mode-picker"><h2>How do you want to play?</h2><button type="button" onClick={() => setMode('bot')}>Play against Bot</button><button type="button" onClick={() => setMode('friend-picker')}>Play with a Friend</button></div>}
      {mode === 'bot' && <TicTacToe mode="bot" />}
    </div>
  }

  if (activeGame && (mode === 'friend-picker' || mode === 'mode-picker')) {
    return <div className="games-view">
      <button className="games-view__back" type="button" onClick={() => { setActiveGame(null); setMode('directory') }}><ArrowLeft size={17} aria-hidden="true" />All games</button>
      <div className="games-mode-picker"><h2>Play {selectedGame?.label} with a friend</h2>
        {grouped.online.length > 0 && <p className="games-online-summary" aria-live="polite">Online now: {onlineFriendNames(friends, onlineUserIds).join(', ')}</p>}
        {[...grouped.online, ...grouped.offline].map((friend) => {
          const existing = getActiveGameRequests(requests, now).find((request) => request.game_type === activeGame && request.requester_id === userId && request.recipient_id === friend.id)
          return <div className="games-friend-row" key={friend.id}><div><strong>{friend.display_name}</strong><small>{onlineUserIds.has(friend.id) ? '● Online' : '○ Offline'}</small></div><button type="button" disabled={Boolean(existing)} onClick={() => void sendRequest(friend)}>{existing ? 'Request sent' : 'Send request'}</button></div>
        })}
        {friends.length === 0 && <p>Pair with your partner before starting a shared game.</p>}
        {message && <p className="games-message" aria-live="polite">{message}</p>}
      </div>
    </div>
  }

  return <div className="games-directory">
    <div className="games-directory__intro"><p className="hub-panel__eyebrow">Play together</p><h2>Pick a little game.</h2><p>Choose something quick and make a new memory together.</p></div>
    <div className="games-grid">{PLAYABLE_GAMES.map((game) => <button className="game-card" type="button" key={game.id} onClick={() => { setActiveGame(game.id); setMode(game.id === 'tic-tac-toe' ? 'mode-picker' : 'friend-picker'); setMessage('') }}>
      <span className="game-card__icon"><Gamepad2 size={24} aria-hidden="true" /></span><span className="game-card__copy"><strong>{game.label}</strong><span>{game.description}</span></span><span className="game-card__arrow" aria-hidden="true">→</span>
    </button>)}</div>
  </div>
}

export default Games
