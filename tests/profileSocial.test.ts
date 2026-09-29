import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptedFriendIds, pairedLabel, profileViewModel } from '../src/lib/profileSocial.ts'

test('extracts confirmed friend ids without requiring a partner', () => {
  assert.deepEqual(acceptedFriendIds([
    { requester_id: 'me', recipient_id: 'friend-1', status: 'accepted' },
    { requester_id: 'friend-2', recipient_id: 'me', status: 'accepted' },
    { requester_id: 'me', recipient_id: 'pending', status: 'pending' },
  ], 'me'), ['friend-1', 'friend-2'])
})

test('labels paired and unpaired states', () => {
  assert.equal(pairedLabel(null, null), 'Not paired yet')
  assert.equal(pairedLabel('partner-1', 'Alex'), 'Paired with Alex')
})

test('preserves optional profile fields in the profile view model', () => {
  assert.deepEqual(profileViewModel({ display_name: 'Sam', display_uid: 42, avatar_url: null, partner_id: null, partner_name: null }), {
    displayName: 'Sam', uid: 42, avatarUrl: null, partner: 'Not paired yet', badges: [], upcoming: true,
  })
})
