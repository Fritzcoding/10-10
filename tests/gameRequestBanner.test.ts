import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGameRequestBannerModel, formatRemainingTime, requestActionLabel, requestSenderName } from '../src/lib/gameRequestBanner.ts'
import type { GameRequest } from '../src/lib/gameRequests.ts'

const req = (id = 'r1'): GameRequest => ({ id, requester_id: 'alice', recipient_id: 'bob', game_type: 'tic-tac-toe', status: 'pending', expires_at: '2026-09-28T00:01:00Z', created_at: '2026-09-28T00:00:00Z', updated_at: '2026-09-28T00:00:00Z' })

test('banner shows active incoming requests and unread count', () => {
  const model = buildGameRequestBannerModel([req()], [{ id: 'n', user_id: 'bob', kind: 'game_request', game_request_id: 'r1', title: 'Play', body: 'Join', read_at: null, created_at: '2026-09-28T00:00:00Z' }], new Date('2026-09-28T00:00:30Z'), 'bob')
  assert.equal(model.requests.length, 1)
  assert.equal(model.unreadCount, 1)
  assert.equal(model.requests[0].remainingSeconds, 30)
})

test('banner removes expired requests and formats remaining time', () => {
  assert.equal(buildGameRequestBannerModel([req()], [], new Date('2026-09-28T00:01:00Z'), 'bob').requests.length, 0)
  assert.equal(formatRemainingTime(59), '0:59')
  assert.equal(formatRemainingTime(60), '1:00')
})

test('banner can show the sender identity for an incoming request', () => {
  assert.equal(requestSenderName(req(), { alice: 'Alice' }), 'Alice')
  assert.equal(requestSenderName(req(), {}), 'A friend')
})

test('request actions expose progress while the receiver is interacting', () => {
  assert.equal(requestActionLabel('accept', false), 'Accept')
  assert.equal(requestActionLabel('accept', true), 'Accepting…')
  assert.equal(requestActionLabel('decline', true), 'Declining…')
})
