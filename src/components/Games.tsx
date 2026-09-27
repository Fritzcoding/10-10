import { ArrowLeft, Gamepad2 } from 'lucide-react'
import { useState } from 'react'
import TicTacToe from './games/TicTacToe'
import { useEffect } from 'react'
import { createGameRequest } from '../lib/gameRequests'
import { groupFriendsByPresence, useGamePresence, type FriendProfile } from '../lib/gamePresence'
import { supabase } from '../lib/supabase'
import './Games.css'

function Games() {
  const [activeGame, setActiveGame] = useState<'tic-tac-toe' | null>(null)
  const [mode, setMode] = useState<'directory' | 'mode-picker' | 'friend-picker' | 'bot' | 'remote'>('directory')
  const [userId, setUserId] = useState<string>()
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [message, setMessage] = useState('')
  const { onlineUserIds } = useGamePresence(userId)

  useEffect(() => { void supabase?.auth.getUser().then(({ data }) => setUserId(data.user?.id)) }, [])
  useEffect(() => {
    if (!supabase || !userId) return
    const client = supabase
    void client.from('friend_requests').select('requester_id, recipient_id').eq('status', 'accepted').or(`requester_id.eq.${userId},recipient_id.eq.${userId}`).then(async ({ data }) => {
      const ids = (data ?? []).map((row) => row.requester_id === userId ? row.recipient_id : row.requester_id)
      if (!ids.length) return
      const result = await client.from('profiles').select('id, display_name, avatar_url').in('id', ids)
      setFriends((result.data ?? []) as FriendProfile[])
    })
  }, [userId])

  if (activeGame === 'tic-tac-toe') {
    return (
    <div className="games-view">
        <button className="games-view__back" type="button" onClick={() => { setActiveGame(null); setMode('directory') }}>
          <ArrowLeft size={17} aria-hidden="true" />
          All games
        </button>
        {mode === 'mode-picker' && <div className="games-mode-picker"><h2>How do you want to play?</h2><button type="button" onClick={() => setMode('bot')}>Play against Bot</button><button type="button" onClick={() => setMode('friend-picker')}>Play with a Friend</button></div>}
        {mode === 'friend-picker' && <div className="games-mode-picker"><h2>Choose a friend</h2>{[...groupFriendsByPresence(friends, onlineUserIds).online, ...groupFriendsByPresence(friends, onlineUserIds).offline].map((friend) => <button type="button" key={friend.id} onClick={() => { void createGameRequest(friend.id).then(() => setMessage('Game request sent.')).catch((error: Error) => setMessage(error.message)) }}>{friend.display_name} {onlineUserIds.has(friend.id) ? '· Online' : '· Offline'}</button>)}{friends.length === 0 && <p>No confirmed friends yet.</p>}{message && <p>{message}</p>}</div>}
        {mode === 'bot' && <TicTacToe mode="bot" />}
      </div>
    )
  }

  return (
    <div className="games-directory">
      <div className="games-directory__intro">
        <p className="hub-panel__eyebrow">Play together</p>
        <h2>Pick a little game.</h2>
        <p>Choose something quick and make a new memory together.</p>
      </div>
      <div className="games-grid">
        <button className="game-card" type="button" onClick={() => { setActiveGame('tic-tac-toe'); setMode('mode-picker') }}>
          <span className="game-card__icon"><Gamepad2 size={24} aria-hidden="true" /></span>
          <span className="game-card__copy">
            <strong>Tic-Tac-Toe</strong>
            <span>Classic three-in-a-row</span>
          </span>
          <span className="game-card__arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )
}

export default Games
