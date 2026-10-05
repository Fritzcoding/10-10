export type WouldYouRatherAnswer = 'left' | 'right'
export type HiddenSubmissionResult = { submitted: true; revealed: boolean; submission_count: 1 | 2 }
export type ConversationAnswer = Record<string, unknown>

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requireId(id: string, subject: string): void {
  if (!SESSION_ID.test(id)) throw new Error(`Game ${subject} id is invalid`)
}

export function gameSessionRealtimeFilter(sessionId: string): string {
  requireId(sessionId, 'session')
  return `id=eq.${sessionId}`
}

export function conversationRoundFilter(roundId: string): string {
  requireId(roundId, 'round')
  return `id=eq.${roundId}`
}

export function hiddenAnswerInsertPayload(sessionId: string, answer: WouldYouRatherAnswer) {
  requireId(sessionId, 'session')
  if (answer !== 'left' && answer !== 'right') throw new Error('Answer is invalid')
  return { target_session_id: sessionId, target_answer: answer }
}

export function conversationRoundSubmissionPayload(roundId: string, answer: ConversationAnswer, publicState: Record<string, unknown> | null = null) {
  requireId(roundId, 'round')
  if (!answer || Array.isArray(answer) || typeof answer !== 'object' || 'user_id' in answer || 'player_id' in answer) {
    throw new Error('Answer is invalid')
  }
  return { target_round_id: roundId, target_answer: answer, target_public_state: publicState }
}
