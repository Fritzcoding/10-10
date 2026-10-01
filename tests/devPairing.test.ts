import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptDeveloperGameRequest, applyDeveloperMove, createDeveloperPairingState, sendDeveloperGameRequest } from '../src/lib/devPairing.ts'

test('developer pairing harness lets UID 5 send and UID 6 accept one request', () => {
  const initial = createDeveloperPairingState()
  const sent = sendDeveloperGameRequest(initial, 'dev-5', 'dev-6', new Date('2026-09-30T00:00:00Z'))
  assert.equal(sent.requests.length, 1)
  const accepted = acceptDeveloperGameRequest(sent, sent.requests[0].id, 'dev-6', new Date('2026-09-30T00:00:05Z'))
  assert.equal(accepted.requests[0].status, 'accepted')
  assert.equal(accepted.session?.player_x_id, 'dev-5')
  assert.equal(accepted.session?.player_o_id, 'dev-6')
  assert.equal(accepted.session?.revision, 0)
})

test('developer pairing harness mirrors a move in the shared session', () => {
  const state = acceptDeveloperGameRequest(sendDeveloperGameRequest(createDeveloperPairingState(), 'dev-5', 'dev-6', new Date('2026-09-30T00:00:00Z')), 'dev-request-1', 'dev-6', new Date('2026-09-30T00:00:05Z'))
  const moved = applyDeveloperMove(state, 'dev-5', 0)
  assert.equal(moved.session?.board[0], 'X')
  assert.equal(moved.session?.turn, 'O')
})

test('developer pairing harness expires requests after one minute', () => {
  const sent = sendDeveloperGameRequest(createDeveloperPairingState(), 'dev-5', 'dev-6', new Date('2026-09-30T00:00:00Z'))
  assert.throws(() => acceptDeveloperGameRequest(sent, 'dev-request-1', 'dev-6', new Date('2026-09-30T00:01:00Z')), /expired/)
})
