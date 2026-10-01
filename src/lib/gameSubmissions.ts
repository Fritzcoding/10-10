export type WouldYouRatherAnswer = 'left' | 'right'
export type HiddenSubmissionResult = { submitted: true; revealed: boolean; submission_count: 1 | 2 }

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function gameSessionRealtimeFilter(sessionId: string): string {
  if (!SESSION_ID.test(sessionId)) throw new Error('Game session id is invalid')
  return `id=eq.${sessionId}`
}

export function hiddenAnswerInsertPayload(sessionId: string, answer: WouldYouRatherAnswer) {
  if (!SESSION_ID.test(sessionId)) throw new Error('Game session id is invalid')
  if (answer !== 'left' && answer !== 'right') throw new Error('Answer is invalid')
  return { target_session_id: sessionId, target_answer: answer }
}
