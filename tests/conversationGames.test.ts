import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canRevealConversationRound,
  describeGuessMatches,
  getConversationRoundCreator,
  getLieDetectorReveal,
  validateConversationAnswer,
  validateLieDetectorRound,
} from '../src/lib/conversationGames.ts'

test('conversation answers require nonblank text within the limit', () => {
  assert.equal(validateConversationAnswer('  we met at the beach  '), 'we met at the beach')
  assert.throws(() => validateConversationAnswer('  '), /answer/i)
  assert.throws(() => validateConversationAnswer('x'.repeat(1001)), /1000/)
})

test('Lie Detector requires three distinct statements and a valid lie index', () => {
  assert.deepEqual(validateLieDetectorRound(['A', 'B', 'C'], 1), { statements: ['A', 'B', 'C'], lieIndex: 1 })
  assert.throws(() => validateLieDetectorRound(['A', 'A', 'C'], 0), /different/i)
  assert.throws(() => validateLieDetectorRound(['A', '', 'C'], 0), /statement/i)
  assert.throws(() => validateLieDetectorRound(['A', 'B', 'C'], 3), /lie/i)
})

test('role-based rounds alternate creators and reject invalid round numbers', () => {
  assert.equal(getConversationRoundCreator('requester', 'recipient', 1), 'requester')
  assert.equal(getConversationRoundCreator('requester', 'recipient', 2), 'recipient')
  assert.throws(() => getConversationRoundCreator('requester', 'recipient', 3), /round/i)
})

test('hidden answers reveal only when both submit or the server deadline passes', () => {
  const deadline = '2026-10-01T10:01:00.000Z'
  assert.equal(canRevealConversationRound(1, deadline, new Date('2026-10-01T10:00:59Z')), false)
  assert.equal(canRevealConversationRound(2, deadline, new Date('2026-10-01T10:00:59Z')), true)
  assert.equal(canRevealConversationRound(1, deadline, new Date(deadline)), true)
  assert.equal(canRevealConversationRound(1, null, new Date(deadline)), false)
})

test('Describe guesses are trimmed, case-insensitive exact matches', () => {
  assert.equal(describeGuessMatches('  BLUEBIRD ', 'bluebird'), true)
  assert.equal(describeGuessMatches('blue bird', 'bluebird'), false)
  assert.equal(describeGuessMatches('', 'bluebird'), false)
})

test('Lie Detector reveal shows the marked lie and whether the guess matched', () => {
  assert.deepEqual(getLieDetectorReveal(['One', 'Two', 'Three'], 2, 2), {
    statements: [{ text: 'One', isLie: false }, { text: 'Two', isLie: false }, { text: 'Three', isLie: true }],
    guessWasCorrect: true,
  })
  assert.throws(() => getLieDetectorReveal(['One', 'Two', 'Three'], 2, 3), /guess/i)
})
