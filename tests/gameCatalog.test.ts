import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_CATALOG, ROADMAP_STAGE_CATALOG, type GameId } from '../src/lib/gameCatalog.ts'

test('catalog describes the supported games by type and duration', () => {
  assert.deepEqual(GAME_CATALOG.map(({ id, kind, durationMinutes }) => [id, kind, durationMinutes]), [
    ['tic-tac-toe', 'turn-based', 5],
    ['would-you-rather', 'hidden-answer', 5],
    ['question-cards', 'hidden-answer', 10],
    ['whos-more-likely', 'hidden-answer', 5],
    ['lie-detector', 'role-based', 10],
    ['describe-without-saying-it', 'timed-role-based', 5],
  ] satisfies [GameId, string, number][])
})

test('roadmap metadata covers remaining stages without exposing their features', () => {
  assert.deepEqual(ROADMAP_STAGE_CATALOG.map(({ stage, id }) => [stage, id]), [
    [4, 'conversation-games'], [5, 'tiny-games'], [6, 'shared-relationship-layer'],
    [7, 'drawing-and-images'], [8, 'surprise-delivery'],
  ])
})
