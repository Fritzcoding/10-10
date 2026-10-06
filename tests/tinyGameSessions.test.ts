import test from 'node:test'
import assert from 'node:assert/strict'
import * as tinySessions from '../src/lib/tinyGameSessions.ts'

test('tiny game RPC payloads use the server function argument names', () => {
  assert.equal(typeof tinySessions.tinyGameActionRpcPayload, 'function')
  assert.equal(typeof tinySessions.tinyGameRpsRpcPayload, 'function')
  if (typeof tinySessions.tinyGameActionRpcPayload !== 'function' || typeof tinySessions.tinyGameRpsRpcPayload !== 'function') return
  assert.deepEqual(tinySessions.tinyGameActionRpcPayload('session-1', 4, { type: 'word', word: 'dawn' }), {
    target_session_id: 'session-1', target_revision: 4, target_action: { type: 'word', word: 'dawn' },
  })
  assert.deepEqual(tinySessions.tinyGameRpsRpcPayload('session-1', 'paper'), {
    target_session_id: 'session-1', target_choice: 'paper',
  })
})

test('tiny game state merge keeps the newest server revision', () => {
  assert.equal(typeof tinySessions.mergeTinyGameState, 'function')
  if (typeof tinySessions.mergeTinyGameState !== 'function') return
  const older = { session: { revision: 2 }, state: { game_type: 'word-chain', words: ['cloud'] } }
  const newer = { session: { revision: 3 }, state: { game_type: 'word-chain', words: ['cloud', 'dawn'] } }
  assert.equal(tinySessions.mergeTinyGameState(newer, older), newer)
  assert.equal(tinySessions.mergeTinyGameState(older, newer), newer)
})
