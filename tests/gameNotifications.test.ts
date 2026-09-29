import test from 'node:test'
import assert from 'node:assert/strict'
import { groupFriendsByPresence, onlineUserIdsFromPresence } from '../src/lib/gamePresence.ts'
import { isExpiredNotification, mergeUniqueGameRequests, unreadNotificationCount, type GameNotification } from '../src/lib/gameNotifications.ts'
import type { GameRequest } from '../src/lib/gameRequests.ts'

const friend = (id: string) => ({ id, display_name: id, avatar_url: null })
const request = (id: string): GameRequest => ({ id, requester_id: 'a', recipient_id: 'b', game_type: 'tic-tac-toe', status: 'pending', expires_at: '2026-09-28T00:01:00Z', created_at: '2026-09-28T00:00:00Z', updated_at: '2026-09-28T00:00:00Z' })

test('groups friends online first and treats absent presence as offline', () => {
  assert.deepEqual(groupFriendsByPresence([friend('offline'), friend('online')], new Set(['online'])), { online: [friend('online')], offline: [friend('offline')] })
})

test('extracts tracked user ids from Supabase presence state', () => {
  assert.deepEqual([...onlineUserIdsFromPresence({ me: [{ user_id: 'me' }], friend: [{ user_id: 'friend' }] })], ['me', 'friend'])
})

test('merges duplicate requests and notifications idempotently', () => {
  assert.equal(mergeUniqueGameRequests([request('one')], [request('one'), request('two')]).length, 2)
})

test('counts unread notifications and filters expired notifications', () => {
  const notifications: GameNotification[] = [
    { id: 'n1', user_id: 'u', kind: 'game_request', game_request_id: 'r', title: 'Play', body: 'Join', read_at: null, created_at: '2026-09-28T00:00:00Z', expires_at: '2026-09-28T00:01:00Z' },
    { id: 'n2', user_id: 'u', kind: 'game_request', game_request_id: 'r2', title: 'Play', body: 'Join', read_at: '2026-09-28T00:00:10Z', created_at: '2026-09-28T00:00:00Z', expires_at: '2026-09-28T00:01:00Z' },
  ]
  assert.equal(unreadNotificationCount(notifications), 1)
  assert.equal(isExpiredNotification(notifications[0], new Date('2026-09-28T00:01:00Z')), true)
})
