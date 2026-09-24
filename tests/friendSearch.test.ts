import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeFriendSearch } from '../src/lib/friendSearch.ts'

test('normalizes email searches and selects the email field', () => {
  assert.deepEqual(normalizeFriendSearch('  FRIEND@Example.com '), {
    field: 'email',
    value: 'friend@example.com',
  })
})

test('normalizes human-friendly UID searches and selects the uid field', () => {
  assert.deepEqual(normalizeFriendSearch(' ab12-cd34 '), {
    field: 'uid',
    value: 'AB12-CD34',
  })
})

test('rejects an empty friend search', () => {
  assert.equal(normalizeFriendSearch('   '), null)
})
