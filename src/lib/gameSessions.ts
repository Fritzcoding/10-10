import { getGameOutcome, type Board, type Mark } from './ticTacToe.ts'

export type GameSession = { id: string; game_type: 'tic-tac-toe'; player_x_id: string; player_o_id: string; board: Board; turn: Mark; status: 'active' | 'won' | 'draw' | 'abandoned'; winner: Mark | null }

export function applyRemoteMove(session: GameSession, userId: string, index: number): GameSession {
  if (session.status !== 'active') throw new Error('Game is completed')
  const mark = userId === session.player_x_id ? 'X' : userId === session.player_o_id ? 'O' : null
  if (!mark) throw new Error('User is not a player')
  if (mark !== session.turn) throw new Error('It is not this player turn')
  if (!Number.isInteger(index) || index < 0 || index > 8) throw new Error('Move index is invalid')
  if (session.board[index] !== null) throw new Error('Square is occupied')
  const board = [...session.board] as Board
  board[index] = mark
  const outcome = getGameOutcome(board)
  return { ...session, board, turn: mark === 'X' ? 'O' : 'X', status: outcome.winner ? 'won' : outcome.draw ? 'draw' : 'active', winner: outcome.winner }
}

export async function createRemoteSession(requestId: string): Promise<GameSession> {
  const { acceptGameRequest } = await import('./gameRequests.ts')
  const result = await acceptGameRequest(requestId)
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.from('game_sessions').select('*').eq('id', result.session_id).single()
  if (error) throw error
  return data as GameSession
}

export async function submitRemoteMove(session: GameSession, userId: string, index: number): Promise<GameSession> {
  const next = applyRemoteMove(session, userId, index)
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.from('game_sessions').update({ board: next.board, turn: next.turn, status: next.status, winner: next.winner }).eq('id', session.id).eq('status', 'active').select().single()
  if (error) throw error
  return data as GameSession
}
