import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { submitRemoteMove, type GameSession } from '../../lib/gameSessions'
import TicTacToe from './TicTacToe'

export default function RemoteTicTacToe({ session, userId }: { session: GameSession; userId: string }) {
  const [current, setCurrent] = useState(session)
  const [moveMessage, setMoveMessage] = useState('')
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const channel = client.channel(`game-session-${session.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` }, (payload) => setCurrent(payload.new as GameSession)).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [session.id])
  const playerMark = current.player_x_id === userId ? 'X' : 'O'
  async function submitMove(index: number) {
    if (index < 0) return
    setMoveMessage('')
    try {
      setCurrent(await submitRemoteMove(current, userId, index))
    } catch (error) {
      if (supabase) {
        const { data } = await supabase.from('game_sessions').select('*').eq('id', current.id).maybeSingle()
        if (data) setCurrent(data as GameSession)
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
