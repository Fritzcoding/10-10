import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMove, chooseBotMove, createInitialGameState, getAvailableMoves, getGameOutcome, type Board } from '../src/lib/ticTacToe.ts'

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

test('lists only available moves', () => {
  const state = applyMove(createInitialGameState(), 0)
  assert.deepEqual(getAvailableMoves(state.board), [1, 2, 3, 4, 5, 6, 7, 8])
})

test('bot always chooses an empty square', () => {
  const board = ['X', null, 'O', null, null, 'X', null, 'O', null] as const
  const move = chooseBotMove({ board: [...board] as Board, turn: 'O' })
  assert.notEqual(move, null)
  assert.equal(board[move as number], null)
})

test('reports winner and draw outcomes', () => {
  assert.deepEqual(getGameOutcome(['X', 'X', 'X', 'O', null, 'O', null, null, null]), { winner: 'X', draw: false })
  assert.deepEqual(getGameOutcome(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']), { winner: null, draw: true })
})

test('does not choose a bot move after the board is complete', () => {
  const board = ['X', 'X', 'X', 'O', 'O', null, null, null, null] as const
  assert.equal(chooseBotMove({ board: [...board] as Board, turn: 'O' }), null)
})
