import { ArrowLeft, Gamepad2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import TicTacToe from './games/TicTacToe'
import RemoteTicTacToe from './games/RemoteTicTacToe'
import ConversationGame from './games/ConversationGame'
import TinyGame from './games/TinyGame'
import RemoteTinyGame from './games/RemoteTinyGame'
import DrawingGame from './games/DrawingGame'
import { GAME_CATALOG, type GameId } from '../lib/gameCatalog'
import { createGameRequest, getActiveGameRequests, mergeGameRequests, type GameRequest } from '../lib/gameRequests'
import { friendDisplayName, orderGameRecipients, onlineFriendNames, type FriendProfile } from '../lib/gamePresence'
import { type GameSession } from '../lib/gameSessions'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import './Games.css'

type GamesProps = { userId?: string; onlineUserIds: ReadonlySet<string>; activeSession?: GameSession | null; onSessionExit: () => void }
type GameMode = 'directory' | 'mode-picker' | 'friend-picker' | 'bot' | 'solo'
const PLAYABLE_GAMES = GAME_CATALOG.filter(({ id }) => id !== 'would-you-rather')
const TINY_GAMES = ['memory-match', 'rock-paper-scissors', 'word-chain'] as const

function Games({ userId, onlineUserIds, activeSession, onSessionExit }: GamesProps) {
  const [activeGame, setActiveGame] = useState<GameId | null>(null)
  const [mode, setMode] = useState<GameMode>('directory')
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [partnerId, setPartnerId] = useState<string | null>(null)
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
    let active = true
    const client = supabase
    const loadRecipients = async () => {
      const [{ data: partners, error: partnerError }, { data: accepted, error: friendsError }] = await Promise.all([
        client.rpc('get_couple_partner'),
        client.from('friend_requests').select('requester_id, recipient_id')
          .eq('request_type', 'friend').eq('status', 'accepted')
          .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
      ])
      if (!active) return
      if (partnerError || friendsError) { setMessage(formatSupabaseDataError({ message: partnerError?.message ?? friendsError?.message ?? 'Unable to load game partners.' })); return }
      const partner = Array.isArray(partners) ? partners[0] : null
      const ids = new Set<string>()
      if (partner?.id) ids.add(partner.id)
      for (const row of accepted ?? []) ids.add(row.requester_id === userId ? row.recipient_id : row.requester_id)
      ids.delete(userId)
      const { data: profiles, error } = ids.size
        ? await client.from('profiles').select('id, display_name, email, avatar_url, display_uid').in('id', [...ids])
        : { data: [], error: null }
      if (!active) return
      if (error) { setMessage(formatSupabaseDataError(error ?? { message: 'Unable to load game partners.' })); return }
      setPartnerId(partner?.id ?? null)
      setFriends((profiles ?? []).map((profile) => ({ ...profile, display_name: friendDisplayName(profile), avatar_url: profile.avatar_url ?? null })))
    }
    void loadRecipients()
    return () => { active = false }
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
    setMode(gameId === 'tic-tac-toe' || TINY_GAMES.includes(gameId as typeof TINY_GAMES[number]) ? 'mode-picker' : 'friend-picker')
  }

  const exitGame = () => { setActiveGame(null); setMode('directory'); onSessionExit() }
  const orderedRecipients = orderGameRecipients(friends, partnerId, onlineUserIds)
  const selectedGame = activeGame ? GAME_CATALOG.find((game) => game.id === activeGame) : null

  if (remoteSession) {
    return <div className="games-view">
      <button className="games-view__back" type="button" onClick={exitGame}><ArrowLeft size={17} aria-hidden="true" />All games</button>
      {remoteSession.game_type === 'tic-tac-toe'
        ? <RemoteTicTacToe session={remoteSession} userId={userId ?? ''} />
        : remoteSession.game_type === 'draw-together'
          ? <DrawingGame session={remoteSession} userId={userId ?? ''} onExit={exitGame} />
          : TINY_GAMES.includes(remoteSession.game_type as typeof TINY_GAMES[number])
            ? <RemoteTinyGame session={remoteSession} userId={userId ?? ''} />
            : <ConversationGame session={remoteSession} userId={userId ?? ''} onExit={exitGame} />}
    </div>
  }

  if (activeGame === 'tic-tac-toe' && mode === 'solo') {
    return <div className="games-view">
      <button className="games-view__back" type="button" onClick={() => { setActiveGame(null); setMode('directory') }}><ArrowLeft size={17} aria-hidden="true" />All games</button>
      <TicTacToe mode="solo" />
    </div>
  }

  if (activeGame === 'tic-tac-toe' && mode === 'bot') {
    return <div className="games-view">
      <button className="games-view__back" type="button" onClick={exitGame}><ArrowLeft size={17} aria-hidden="true" />All games</button>
      <TicTacToe mode="bot" />
    </div>
  }

  if (activeGame && TINY_GAMES.includes(activeGame as typeof TINY_GAMES[number]) && (mode === 'solo' || mode === 'bot')) {
    return <div className="games-view">
      <button className="games-view__back" type="button" onClick={exitGame}><ArrowLeft size={17} aria-hidden="true" />All games</button>
      <TinyGame gameId={activeGame as typeof TINY_GAMES[number]} mode={mode} />
    </div>
  }

  if (activeGame && mode === 'mode-picker') {
    return <div className="games-view">
      <button className="games-view__back" type="button" onClick={() => { setActiveGame(null); setMode('directory') }}><ArrowLeft size={17} aria-hidden="true" />All games</button>
      <div className="games-mode-picker"><h2>How do you want to play {selectedGame?.label}?</h2>
        <button type="button" onClick={() => setMode('solo')}>Play by yourself · control both turns</button>
        <button type="button" onClick={() => setMode('bot')}>Play against a bot</button>
        <button type="button" onClick={() => setMode('friend-picker')}>Play with people</button>
      </div>
    </div>
  }

  if (activeGame && mode === 'friend-picker') {
    return <div className="games-view">
      <button className="games-view__back" type="button" onClick={() => { setActiveGame(null); setMode('directory') }}><ArrowLeft size={17} aria-hidden="true" />All games</button>
      <div className="games-mode-picker"><h2>Play {selectedGame?.label} with a friend</h2>
        {onlineFriendNames(friends.filter(({ id }) => id !== partnerId), onlineUserIds).length > 0 && <p className="games-online-summary" aria-live="polite">Online now: {onlineFriendNames(friends.filter(({ id }) => id !== partnerId), onlineUserIds).join(', ')}</p>}
        {orderedRecipients.map((friend) => {
          const existing = getActiveGameRequests(requests, now).find((request) => request.game_type === activeGame && request.requester_id === userId && request.recipient_id === friend.id)
          return <div className="games-friend-row" key={friend.id}><div><strong>{friend.display_name}{friend.id === partnerId ? ' · Partner' : ''}</strong><small>{onlineUserIds.has(friend.id) ? '● Online' : '○ Offline'}</small></div><button type="button" disabled={Boolean(existing)} onClick={() => void sendRequest(friend)}>{existing ? 'Request sent' : 'Send request'}</button></div>
        })}
        {friends.length === 0 && <p>Add a friend or pair with your partner before starting a shared game.</p>}
        {message && <p className="games-message" aria-live="polite">{message}</p>}
      </div>
    </div>
  }

  return <div className="games-directory">
    <div className="games-directory__intro"><p className="hub-panel__eyebrow">Play together</p><h2>Pick a little game.</h2><p>Choose something quick and make a new memory together.</p></div>
    <div className="games-grid">{PLAYABLE_GAMES.map((game) => <button className="game-card" type="button" key={game.id} onClick={() => startGame(game.id)}>
      <span className="game-card__icon"><Gamepad2 size={24} aria-hidden="true" /></span><span className="game-card__copy"><strong>{game.label}</strong><span>{game.description}</span></span><span className="game-card__arrow" aria-hidden="true">→</span>
    </button>)}</div>
  </div>
}

export default Games
