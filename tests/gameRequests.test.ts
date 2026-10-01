import test from 'node:test'
import assert from 'node:assert/strict'
import { canAcceptGameRequest, gameRequestAcceptRpcPayload, gameRequestDeclineRpcPayload, gameRequestInsertPayload, gameRequestPeerId, gameRequestRpcPayload, gameRequestStatusLabel, getActiveGameRequests, isGameRequestActive, mergeGameRequests, partitionGameRequests, type GameRequest } from '../src/lib/gameRequests.ts'

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
  assert.deepEqual(gameRequestInsertPayload('me', 'friend', 'would-you-rather'), { requester_id: 'me', recipient_id: 'friend', game_type: 'would-you-rather' })
})

test('request RPC payload matches the unambiguous database parameter', () => {
  assert.deepEqual(gameRequestRpcPayload('friend'), { target_recipient_id: 'friend' })
  assert.deepEqual(gameRequestRpcPayload('friend', 'would-you-rather'), { target_recipient_id: 'friend', target_game_type: 'would-you-rather' })
})

test('accept RPC payload matches the unambiguous database parameter', () => {
  assert.deepEqual(gameRequestAcceptRpcPayload('request-1'), { target_request_id: 'request-1' })
})

test('decline uses its recipient-validated RPC instead of a direct table update', () => {
  assert.deepEqual(gameRequestDeclineRpcPayload('request-1'), { target_request_id: 'request-1' })
})

test('request presentation identifies the other account and pending direction', () => {
  const outgoing = request({ requester_id: 'me', recipient_id: 'friend' })
  const incoming = request({ requester_id: 'friend', recipient_id: 'me' })
  assert.equal(gameRequestPeerId(outgoing, 'me'), 'friend')
  assert.equal(gameRequestPeerId(incoming, 'me'), 'friend')
  assert.equal(gameRequestStatusLabel(outgoing, 'me'), 'Request sent')
  assert.equal(gameRequestStatusLabel(incoming, 'me'), 'Wants to play')
})

test('active request list excludes pending rows that expired yesterday', () => {
  const now = new Date('2026-09-29T00:00:00.000Z')
  assert.deepEqual(getActiveGameRequests([
    request({ expires_at: '2026-09-28T00:01:00.000Z' }),
    request({ id: 'request-2', expires_at: '2026-09-29T00:01:00.000Z' }),
  ], now).map((item) => item.id), ['request-2'])
})
