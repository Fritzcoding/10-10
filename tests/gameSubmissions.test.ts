import test from 'node:test'
import assert from 'node:assert/strict'
import { gameSessionRealtimeFilter, hiddenAnswerInsertPayload } from '../src/lib/gameSubmissions.ts'

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
