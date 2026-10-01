import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_CATALOG, type GameId } from '../src/lib/gameCatalog.ts'

test('catalog describes the two supported games by type and duration', () => {
  assert.deepEqual(GAME_CATALOG.map(({ id, kind, durationMinutes }) => [id, kind, durationMinutes]), [
    ['tic-tac-toe', 'turn-based', 5],
    ['would-you-rather', 'hidden-answer', 5],
  ] satisfies [GameId, string, number][])
})
