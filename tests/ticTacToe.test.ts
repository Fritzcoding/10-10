import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMove, createInitialGameState } from '../src/lib/ticTacToe.ts'

test('applies a move and advances the turn', () => {
  const state = applyMove(createInitialGameState(), 0)

  assert.deepEqual(state, {
    board: ['X', null, null, null, null, null, null, null, null],
    turn: 'O',
  })
})

test('ignores moves on occupied cells', () => {
  const state = applyMove(createInitialGameState(), 0)
  assert.deepEqual(applyMove(state, 0), state)
})
