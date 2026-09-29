import test from 'node:test'
import assert from 'node:assert/strict'
import { canAcceptGameRequest, gameRequestInsertPayload, isGameRequestActive, mergeGameRequests, partitionGameRequests, type GameRequest } from '../src/lib/gameRequests.ts'

const request = (overrides: Partial<GameRequest> = {}): GameRequest => ({
  id: 'request-1', requester_id: 'alice', recipient_id: 'bob', game_type: 'tic-tac-toe', status: 'pending',
  expires_at: '2026-09-28T00:01:00.000Z', created_at: '2026-09-28T00:00:00.000Z', updated_at: '2026-09-28T00:00:00.000Z', ...overrides,
})

test('request is active before expiry and expired at the boundary', () => {
  const expires = new Date('2026-09-28T00:01:00.000Z')
  assert.equal(isGameRequestActive(request(), new Date(expires.getTime() - 1)), true)
  assert.equal(isGameRequestActive(request(), expires), false)
})

test('partitions incoming and outgoing requests by user', () => {
  const incoming = request()
  const outgoing = request({ id: 'request-2', requester_id: 'bob', recipient_id: 'alice' })
  assert.deepEqual(partitionGameRequests([incoming, outgoing], 'bob'), { incoming: [incoming], outgoing: [outgoing] })
})

test('deduplicates pending requests while retaining the newest version', () => {
  const newer = request({ status: 'accepted', updated_at: '2026-09-28T00:00:30.000Z' })
  assert.deepEqual(mergeGameRequests([request()], [newer]), [newer])
})

test('acceptance only allows active pending requests', () => {
  assert.equal(canAcceptGameRequest(request(), new Date('2026-09-28T00:00:59.999Z')), true)
  assert.equal(canAcceptGameRequest(request(), new Date('2026-09-28T00:01:00.000Z')), false)
  assert.equal(canAcceptGameRequest(request({ status: 'accepted' }), new Date('2026-09-28T00:00:30.000Z')), false)
})

test('request insert includes the authenticated requester for RLS', () => {
  assert.deepEqual(gameRequestInsertPayload('me', 'friend'), { requester_id: 'me', recipient_id: 'friend', game_type: 'tic-tac-toe' })
})
