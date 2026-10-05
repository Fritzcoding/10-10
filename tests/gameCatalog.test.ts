import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_CATALOG, ROADMAP_STAGE_CATALOG, type GameId } from '../src/lib/gameCatalog.ts'

test('catalog describes every supported game by type, duration, and availability', () => {
  assert.deepEqual(GAME_CATALOG.map(({ id, kind, durationMinutes, availability }) => [id, kind, durationMinutes, availability]), [
    ['tic-tac-toe', 'turn-based', 5, 'either'],
    ['would-you-rather', 'hidden-answer', 5, 'partner'],
    ['question-cards', 'hidden-answer', 10, 'partner'],
    ['whos-more-likely', 'hidden-answer', 5, 'partner'],
    ['lie-detector', 'role-based', 10, 'partner'],
    ['describe-without-saying-it', 'timed-role-based', 5, 'partner'],
    ['memory-match', 'turn-based', 5, 'local'],
    ['rock-paper-scissors', 'hidden-answer', 2, 'local'],
    ['word-chain', 'turn-based', 5, 'local'],
  ] satisfies [GameId, string, number, string][])
})

test('roadmap metadata covers remaining stages without exposing their features', () => {
  assert.deepEqual(ROADMAP_STAGE_CATALOG.map(({ stage, id }) => [stage, id]), [
    [4, 'conversation-games'], [5, 'tiny-games'], [6, 'shared-relationship-layer'],
    [7, 'drawing-and-images'], [8, 'surprise-delivery'],
  ])
})

test('Stage 5 catalog entries are short local games with duration and availability metadata', () => {
  assert.deepEqual(GAME_CATALOG.filter(({ id }) => ['memory-match', 'rock-paper-scissors', 'word-chain'].includes(id)).map(({ id, durationMinutes, availability }) => [id, durationMinutes, availability]), [
    ['memory-match', 5, 'local'],
    ['rock-paper-scissors', 2, 'local'],
    ['word-chain', 5, 'local'],
  ])
})
