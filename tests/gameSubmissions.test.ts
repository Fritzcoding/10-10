import test from 'node:test'
import assert from 'node:assert/strict'
import {
  conversationRoundFilter,
  conversationRoundSubmissionPayload,
  gameSessionRealtimeFilter,
  hiddenAnswerInsertPayload,
} from '../src/lib/gameSubmissions.ts'

test('builds a session filter only for a UUID', () => {
  assert.equal(gameSessionRealtimeFilter('f0000000-0000-4000-8000-000000000001'), 'id=eq.f0000000-0000-4000-8000-000000000001')
  assert.throws(() => gameSessionRealtimeFilter('x,player_x_id=eq.anyone'), /session id/)
})

test('hidden answer payload contains no client-supplied participant identity', () => {
  assert.deepEqual(hiddenAnswerInsertPayload('f0000000-0000-4000-8000-000000000001', 'left'), {
    target_session_id: 'f0000000-0000-4000-8000-000000000001', target_answer: 'left',
  })
  assert.throws(() => hiddenAnswerInsertPayload('f0000000-0000-4000-8000-000000000001', 'skip' as never), /[Aa]nswer/)
})

test('conversation realtime filters and RPC payloads contain no client identity', () => {
  const roundId = 'f0000000-0000-4000-8000-000000000001'
  assert.equal(conversationRoundFilter(roundId), 'id=eq.' + roundId)
  assert.deepEqual(conversationRoundSubmissionPayload(roundId, { choice: 'me' }), {
    target_round_id: roundId, target_answer: { choice: 'me' }, target_public_state: null,
  })
  assert.throws(() => conversationRoundSubmissionPayload('bad', { answer: 'hi' }), /round id/i)
})
