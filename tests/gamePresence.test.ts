import test from 'node:test'
import assert from 'node:assert/strict'
import * as presence from '../src/lib/gamePresence.ts'

const friend = (id: string) => ({ id, display_name: id, avatar_url: null })

test('partner is first even while offline, followed by online and offline friends', () => {
  assert.equal(typeof presence.orderGameRecipients, 'function')
  if (typeof presence.orderGameRecipients !== 'function') return
  const friends = [friend('offline'), friend('online-2'), friend('partner'), friend('online-1')]
  assert.deepEqual(
    presence.orderGameRecipients(friends, 'partner', new Set(['online-1', 'online-2'])).map(({ id }) => id),
    ['partner', 'online-2', 'online-1', 'offline'],
  )
})

test('recipient ordering removes duplicate profiles', () => {
  assert.equal(typeof presence.orderGameRecipients, 'function')
  if (typeof presence.orderGameRecipients !== 'function') return
  assert.deepEqual(
    presence.orderGameRecipients([friend('partner'), friend('partner'), friend('friend')], 'partner', new Set()).map(({ id }) => id),
    ['partner', 'friend'],
  )
})
