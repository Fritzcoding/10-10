import { ArrowLeft, Gamepad2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import TicTacToe from './games/TicTacToe'
import RemoteTicTacToe from './games/RemoteTicTacToe'
import ConversationGame from './games/ConversationGame'
import TinyGame from './games/TinyGame'
import { GAME_CATALOG, type GameId } from '../lib/gameCatalog'
import { readGameHistory, recommendGames } from '../lib/tinyGames'
import { createGameRequest, getActiveGameRequests, mergeGameRequests, type GameRequest } from '../lib/gameRequests'
import { friendDisplayName, groupFriendsByPresence, onlineFriendNames, type FriendProfile } from '../lib/gamePresence'
import { type GameSession } from '../lib/gameSessions'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import './Games.css'

type GamesProps = { userId?: string; onlineUserIds: ReadonlySet<string>; activeSession?: GameSession | null; onSessionExit: () => void }
type GameMode = 'directory' | 'mode-picker' | 'friend-picker' | 'bot' | 'remote' | 'local'
const PLAYABLE_GAMES = GAME_CATALOG.filter(({ id }) => id !== 'would-you-rather')
const TINY_GAMES = ['memory-match', 'rock-paper-scissors', 'word-chain'] as const

function loadGameHistory(key: string): Record<string, number> {
  try { return readGameHistory(window.localStorage.getItem(key)) }
  catch { return {} }
}

function Games({ userId, onlineUserIds, activeSession, onSessionExit }: GamesProps) {
  const historyKey = `couple-game-history:${userId ?? 'guest'}`
  const [activeGame, setActiveGame] = useState<GameId | null>(null)
  const [mode, setMode] = useState<GameMode>('directory')
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [requests, setRequests] = useState<GameRequest[]>([])
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [availableMinutes, setAvailableMinutes] = useState(5)
  const [recent, setRecent] = useState<Record<string, number>>(() => loadGameHistory(historyKey))
  const remoteSession = activeSession ?? null
  const recordedSessionId = useRef<string | null>(null)
  const partnerOnline = friends.some(({ id }) => onlineUserIds.has(id))
  const markPlayed = useCallback((gameId: GameId, playedAt: number) => {
    const next = { ...recent, [gameId]: playedAt }
    setRecent(next)
    try { window.localStorage.setItem(historyKey, JSON.stringify(next)) }
    catch { /* Recommendations still work without saved recency. */ }
  }, [historyKey, recent])
  const sessionId = remoteSession?.id
  const sessionGameId = remoteSession ? GAME_CATALOG.find(({ id }) => id === remoteSession.game_type)?.id : undefined

  useEffect(() => {
    if (!sessionId || !sessionGameId || recordedSessionId.current === sessionId) return
    recordedSessionId.current = sessionId
    markPlayed(sessionGameId, now.getTime())
  }, [markPlayed, now, sessionGameId, sessionId])

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

  const startGame = (gameId: GameId) => {
    setActiveGame(gameId)
    setMessage('')
    if (TINY_GAMES.includes(gameId as typeof TINY_GAMES[number])) {
      setMode('local')
      markPlayed(gameId, now.getTime())
    } else setMode(gameId === 'tic-tac-toe' ? 'mode-picker' : 'friend-picker')
  }

  const exitGame = () => { setActiveGame(null); setMode('directory'); onSessionExit() }
  const grouped = groupFriendsByPresence(friends, onlineUserIds)
  const selectedGame = activeGame ? GAME_CATALOG.find((game) => game.id === activeGame) : null
  const recommendations = recommendGames(PLAYABLE_GAMES, { availableMinutes, partnerOnline, recent })

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
      {mode === 'mode-picker' && <div className="games-mode-picker"><h2>How do you want to play?</h2><button type="button" onClick={() => { markPlayed('tic-tac-toe', now.getTime()); setMode('bot') }}>Play against Bot</button><button type="button" onClick={() => setMode('friend-picker')}>Play with a Friend</button></div>}
      {mode === 'bot' && <TicTacToe mode="bot" />}
    </div>
  }

  if (activeGame && mode === 'local' && TINY_GAMES.includes(activeGame as typeof TINY_GAMES[number])) {
    return <div className="games-view">
      <button className="games-view__back" type="button" onClick={exitGame}><ArrowLeft size={17} aria-hidden="true" />All games</button>
      <TinyGame gameId={activeGame as typeof TINY_GAMES[number]} />
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
    <section className="bored-mode" aria-labelledby="bored-mode-title">
      <div className="bored-mode__heading"><div><p className="hub-panel__eyebrow">Bored Mode</p><h3 id="bored-mode-title">What fits right now?</h3></div><label>We have<select value={availableMinutes} onChange={(event) => setAvailableMinutes(Number(event.target.value))}><option value={2}>2 minutes</option><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option></select></label></div>
      <p className="bored-mode__availability">{partnerOnline ? 'Your partner is online.' : 'Your partner is offline; showing games you can start here.'}</p>
      <div className="bored-mode__picks">{recommendations.length ? recommendations.map((game) => <button type="button" className="bored-mode__pick" key={game.id} onClick={() => startGame(game.id)}><span><strong>{game.label}</strong><small>{game.durationMinutes} min</small></span><span>{game.reason}</span></button>) : <p>No games fit that time yet. Try a longer window.</p>}</div>
    </section>
    <div className="games-grid">{PLAYABLE_GAMES.map((game) => <button className="game-card" type="button" key={game.id} onClick={() => startGame(game.id)}>
      <span className="game-card__icon"><Gamepad2 size={24} aria-hidden="true" /></span><span className="game-card__copy"><strong>{game.label}</strong><span>{game.description}</span></span><span className="game-card__arrow" aria-hidden="true">→</span>
    </button>)}</div>
  </div>
}

export default Games
