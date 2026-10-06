import type { GameSession } from './gameSessions.ts'
import type { RockPaperScissorsChoice } from './tinyGames.ts'

export type TinyPublicState =
  | { game_type: 'memory-match'; cards: { id: number; pair: string | null }[]; revealed: number[]; matched: number[]; scores: [number, number] }
  | { game_type: 'word-chain'; words: string[] }
  | { game_type: 'rock-paper-scissors' }
export type TinyGameAction = { type: 'flip'; index: number } | { type: 'word'; word: string }
export type TinyGameEnvelope = { session: GameSession; state: TinyPublicState; choices: { user_id: string; choice: RockPaperScissorsChoice }[] }

export function tinyGameActionRpcPayload(sessionId: string, revision: number, action: TinyGameAction) {
  return { target_session_id: sessionId, target_revision: revision, target_action: action }
}

export function tinyGameRpsRpcPayload(sessionId: string, choice: RockPaperScissorsChoice) {
  return { target_session_id: sessionId, target_choice: choice }
}

export function mergeTinyGameState(current: TinyGameEnvelope, incoming: TinyGameEnvelope): TinyGameEnvelope {
  return incoming.session.revision >= current.session.revision ? incoming : current
}

export async function getTinyGameState(sessionId: string): Promise<TinyGameEnvelope> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const [{ data: session, error: sessionError }, { data: state, error: stateError }, { data: user }] = await Promise.all([
    supabase.from('game_sessions').select('*').eq('id', sessionId).single(),
    supabase.from('tiny_game_states').select('state').eq('session_id', sessionId).single(),
    supabase.auth.getUser(),
  ])
  if (sessionError) throw sessionError
  if (stateError) throw stateError
  const { data: choices, error: choicesError } = await supabase
    .from('tiny_game_choices').select('user_id, choice').eq('session_id', sessionId)
  if (choicesError) throw choicesError
  const playerId = user.user?.id
  return {
    session: session as GameSession,
    state: state.state as TinyPublicState,
    choices: (choices ?? []).filter((choice) => choice.user_id !== playerId || (choices?.length ?? 0) === 2) as TinyGameEnvelope['choices'],
  }
}

export async function submitTinyGameAction(sessionId: string, revision: number, action: TinyGameAction): Promise<TinyGameEnvelope> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('submit_tiny_game_action', tinyGameActionRpcPayload(sessionId, revision, action))
  if (error) throw error
  return getTinyGameState(sessionId)
}

export async function submitTinyGameRpsChoice(sessionId: string, choice: RockPaperScissorsChoice): Promise<TinyGameEnvelope> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('submit_tiny_game_rps_choice', tinyGameRpsRpcPayload(sessionId, choice))
  if (error) throw error
  return getTinyGameState(sessionId)
}
