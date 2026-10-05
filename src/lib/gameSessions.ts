import { getGameOutcome, type Board, type Mark } from './ticTacToe.ts'
import type { GameId } from './gameCatalog.ts'
import { conversationRoundSubmissionPayload, hiddenAnswerInsertPayload, type ConversationAnswer, type HiddenSubmissionResult, type WouldYouRatherAnswer } from './gameSubmissions.ts'

export type GameSession = { id: string; game_type: GameId; player_x_id: string; player_o_id: string; board: Board; turn: Mark; status: 'active' | 'won' | 'draw' | 'abandoned' | 'completed'; winner: Mark | null; revision: number; deadline_at: string | null; current_round?: number }
export type ConversationGameRound = { id: string; session_id: string; round_number: number; creator_id: string; prompt_id: string | null; public_state: Record<string, unknown> | null; deadline_at: string | null; status: 'active' | 'completed'; completed_at: string | null }
export type ConversationGameSubmission = { round_id: string; user_id: string; answer: ConversationAnswer; submitted_at: string }

export function latestGameSession(current: GameSession, incoming: GameSession): GameSession {
  return incoming.revision >= current.revision ? incoming : current
}

export function ticTacToeMoveRpcPayload(sessionId: string, revision: number, cell: number) {
  return { target_session_id: sessionId, target_revision: revision, target_cell: cell }
}

export function isSessionForUser(session: Pick<GameSession, 'player_x_id' | 'player_o_id'>, userId: string): boolean {
  return session.player_x_id === userId || session.player_o_id === userId
}

export function applyRemoteMove(session: GameSession, userId: string, index: number): GameSession {
  if (session.game_type !== 'tic-tac-toe') throw new Error('This game does not support Tic-Tac-Toe moves')
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
  applyRemoteMove(session, userId, index)
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('submit_tic_tac_toe_move', ticTacToeMoveRpcPayload(session.id, session.revision, index))
  if (error) throw error
  return data as GameSession
}

export async function submitHiddenGameAnswer(sessionId: string, answer: WouldYouRatherAnswer): Promise<HiddenSubmissionResult> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('submit_hidden_game_answer', hiddenAnswerInsertPayload(sessionId, answer))
  if (error) throw error
  return data as HiddenSubmissionResult
}

export async function startConversationGame(sessionId: string, promptId: string | null = null): Promise<ConversationGameRound> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('start_conversation_game', { target_session_id: sessionId, target_prompt_id: promptId })
  if (error) throw error
  return data as ConversationGameRound
}

export async function submitConversationAnswer(roundId: string, answer: ConversationAnswer, publicState: Record<string, unknown> | null = null): Promise<{ submitted: true; revealed: boolean; submission_count: number; round_completed: boolean; session_completed: boolean }> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('submit_conversation_game_answer', conversationRoundSubmissionPayload(roundId, answer, publicState))
  if (error) throw error
  return data
}

export async function getDescribeWord(roundId: string): Promise<{ word: string; forbidden: string[] }> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('get_describe_game_word', { target_round_id: roundId })
  if (error) throw error
  return data as { word: string; forbidden: string[] }
}

export async function expireConversationRound(roundId: string): Promise<{ expired: boolean; round_completed: boolean; session_completed: boolean }> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('expire_conversation_game_round', { target_round_id: roundId })
  if (error) throw error
  return data
}
