import test from 'node:test'
import assert from 'node:assert/strict'
import { authIdentifierTarget, executeProfileSearch, formatProfileUid, friendRequestStatusLabel, normalizeFriendSearch, normalizeProfileSearchInput, profileSearchFields, profileSearchReadiness, profileSearchRpcPayload, profileSearchTarget } from '../src/lib/friendSearch.ts'
import { friendRequestResponseRpcPayload, hasPendingRequest, partitionPendingRequests } from '../src/lib/friendRequests.ts'
import { appendUniqueMessage, isConversationMessage } from '../src/lib/chat.ts'
import { formatSupabaseDataError } from '../src/lib/supabaseErrors.ts'

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

test('normalizes email and numeric display UID search input', () => {
  assert.equal(normalizeProfileSearchInput('  FRIEND@Example.com '), 'friend@example.com')
  assert.equal(normalizeProfileSearchInput(' 42 '), '42')
})

test('builds type-safe profile search targets', () => {
  assert.deepEqual(profileSearchTarget('friend@example.com'), { field: 'email', value: 'friend@example.com' })
  assert.deepEqual(profileSearchTarget('42'), { field: 'display_uid', value: 42 })
})

test('profile lookup RPC receives a literal exact-match search value', () => {
  assert.deepEqual(profileSearchRpcPayload(profileSearchTarget('42')!), { target_query: '42' })
  assert.deepEqual(profileSearchRpcPayload(profileSearchTarget('Friend@example.com')!), { target_query: 'friend@example.com' })
})

test('friend acceptance RPC identifies the request and acceptance decision', () => {
  assert.deepEqual(friendRequestResponseRpcPayload('request-1', true), { target_request_id: 'request-1', accept_request: true })
})

test('routes auth identifiers to email or numeric display UID', () => {
  assert.deepEqual(authIdentifierTarget(' user@example.com '), { field: 'email', value: 'user@example.com' })
  assert.deepEqual(authIdentifierTarget(' 42 '), { field: 'display_uid', value: 42 })
  assert.equal(authIdentifierTarget('not-an-email-or-uid'), null)
})

test('falls back to a placeholder when the profile UID is unavailable', () => {
  assert.equal(formatProfileUid(undefined), 'UID: #--')
  assert.equal(formatProfileUid(null), 'UID: #--')
  assert.equal(formatProfileUid(42), 'UID: #42')
})

test('uses only fields required to render a searched profile', () => {
  assert.equal(profileSearchFields, 'id, display_uid, email, display_name')
})

test('labels searched profile actions by relationship state', () => {
  assert.equal(friendRequestStatusLabel(true, false), 'Friends')
  assert.equal(friendRequestStatusLabel(false, true), 'Request sent')
  assert.equal(friendRequestStatusLabel(false, false), 'Add Friend')
})

test('executes a numeric UID search and returns the matching profile', async () => {
  let receivedTarget
  const profile = { id: 'user-6', display_uid: 6, email: 'fritzhans1689@gmail.com', display_name: 'Fritz' }
  const result = await executeProfileSearch(' 6 ', async (target) => {
    receivedTarget = target
    return { data: profile, error: null }
  })
  assert.deepEqual(receivedTarget, { field: 'display_uid', value: 6 })
  assert.deepEqual(result, profile)
})

test('reports when search is attempted before the authenticated user is ready', () => {
  assert.equal(profileSearchReadiness(true, 'user-5'), null)
  assert.equal(profileSearchReadiness(true, undefined), 'Your profile is still loading. Try searching again in a moment.')
  assert.equal(profileSearchReadiness(false, 'user-5'), 'Supabase is not configured. Add the required environment variables.')
})

test('detects a pending request in either direction', () => {
  assert.equal(hasPendingRequest([
    { requester_id: 'friend', recipient_id: 'me', status: 'pending' },
  ], 'me', 'friend'), true)
})

test('does not treat an accepted request as pending', () => {
  assert.equal(hasPendingRequest([
    { requester_id: 'me', recipient_id: 'friend', status: 'accepted' },
  ], 'me', 'friend'), false)
})

test('partitions pending requests so incoming requests remain visible', () => {
  const requests = [
    { id: 'incoming', requester_id: 'friend', recipient_id: 'me', status: 'pending' },
    { id: 'outgoing', requester_id: 'me', recipient_id: 'other', status: 'pending' },
    { id: 'accepted', requester_id: 'friend', recipient_id: 'me', status: 'accepted' },
  ]
  assert.deepEqual(partitionPendingRequests(requests, 'me'), {
    incoming: [requests[0]],
    outgoing: [requests[1]],
  })
})

test('matches only messages from the selected conversation', () => {
  assert.equal(isConversationMessage({ sender_id: 'me', recipient_id: 'friend' }, 'me', 'friend'), true)
  assert.equal(isConversationMessage({ sender_id: 'other', recipient_id: 'friend' }, 'me', 'friend'), false)
})

test('appends each chat message only once', () => {
  const first = { id: '1', sender_id: 'me', recipient_id: 'friend', body: 'Hi', created_at: '2026-09-24T00:00:00Z' }
  assert.deepEqual(appendUniqueMessage([first], first), [first])
})

test('turns missing Supabase tables into an actionable migration message', () => {
  assert.equal(
    formatSupabaseDataError({ message: "Could not find the table 'public.friend_requests' in the schema cache" }),
    'Your database is missing the friend request table. Apply the Supabase migrations, then reload the app.',
  )
  assert.equal(
    formatSupabaseDataError({ message: 'new row violates row-level security policy' }),
    'new row violates row-level security policy',
  )
})

test('turns missing partner profile columns into an actionable migration message', () => {
  assert.equal(
    formatSupabaseDataError({ message: 'column profiles.partner_id does not exist' }),
    'Your database is missing partner profile columns. Apply the latest Supabase migrations, then reload the app.',
  )
})

test('turns a missing game request RPC into an actionable migration message', () => {
  assert.equal(
    formatSupabaseDataError({ message: 'Could not find the function public.create_game_request(recipient_id) in the schema cache' }),
    'Your database is missing the game request migration. Apply 202609300001_expire_game_requests.sql, then reload the app.',
  )
})

test('turns missing relationship RPCs into an actionable migration message', () => {
  const expected = 'Your database is missing the relationship authorization migration. Apply 20260930173655_stage_1_relationship_authorization_foundation.sql, then reload the app.'
  assert.equal(
    formatSupabaseDataError({ message: 'Could not find the function public.get_couple_partner without parameters in the schema cache' }),
    expected,
  )
  assert.equal(
    formatSupabaseDataError({ message: 'Could not find the function public.respond_to_friend_request(accept_request, target_request_id) in the schema cache' }),
    expected,
  )
})
