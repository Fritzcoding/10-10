import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { latestGameSession, submitRemoteMove, type GameSession } from '../../lib/gameSessions'
import { gameSessionRealtimeFilter } from '../../lib/gameSubmissions'
import TicTacToe from './TicTacToe'

export default function RemoteTicTacToe({ session, userId }: { session: GameSession; userId: string }) {
  const [current, setCurrent] = useState(session)
  const [moveMessage, setMoveMessage] = useState('')
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const refresh = async () => {
      const { data } = await client.from('game_sessions').select('*').eq('id', session.id).maybeSingle()
      if (data) setCurrent((latest) => latestGameSession(latest, data as GameSession))
    }
    const channel = client.channel(`game-session-${session.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: gameSessionRealtimeFilter(session.id) }, (payload) => setCurrent((latest) => latestGameSession(latest, payload.new as GameSession))).subscribe((status) => { if (status === 'SUBSCRIBED') void refresh() })
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('focus', refresh); void client.removeChannel(channel) }
  }, [session.id])
  const playerMark = current.player_x_id === userId ? 'X' : 'O'
  async function submitMove(index: number) {
    if (index < 0) return
    setMoveMessage('')
    try {
      const updated = await submitRemoteMove(current, userId, index)
      setCurrent((latest) => latestGameSession(latest, updated))
    } catch (error) {
      if (supabase) {
        const { data } = await supabase.from('game_sessions').select('*').eq('id', current.id).maybeSingle()
        if (data) setCurrent((latest) => latestGameSession(latest, data as GameSession))
      }
      const message = error instanceof Error ? error.message : ''
      setMoveMessage(message.includes('stale_revision') ? 'The board changed. It’s refreshed; try again.' : 'Your move could not be saved. Please try again.')
    }
  }
  return <>
    <TicTacToe mode="remote" playerMark={playerMark} remoteState={{ board: current.board, turn: current.turn }} onMove={submitMove} />
    {moveMessage && <p className="games-message" role="status">{moveMessage}</p>}
  </>
}
