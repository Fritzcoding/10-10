import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { submitRemoteMove, type GameSession } from '../../lib/gameSessions'
import TicTacToe from './TicTacToe'

export default function RemoteTicTacToe({ session, userId }: { session: GameSession; userId: string }) {
  const [current, setCurrent] = useState(session)
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const channel = client.channel(`game-session-${session.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` }, (payload) => setCurrent(payload.new as GameSession)).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [session.id])
  const playerMark = current.player_x_id === userId ? 'X' : 'O'
  return <TicTacToe mode="remote" playerMark={playerMark} remoteState={{ board: current.board, turn: current.turn }} onMove={(index) => { if (index >= 0) void submitRemoteMove(current, userId, index).then(setCurrent) }} />
}
