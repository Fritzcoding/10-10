import test from 'node:test'
import assert from 'node:assert/strict'
import { BOARD_COLORS, isCurrentBoardGeneration, moveKeyboardCursor, normalizePointerPoint, validateBoardStroke } from '../src/lib/loveBoard.ts'

test('stroke validation enforces point, color and width bounds', () => {
  const points = [{ x: 0, y: 10 }, { x: 1000, y: 990 }]
  assert.deepEqual(validateBoardStroke(points, BOARD_COLORS[0], 8), { points, color: BOARD_COLORS[0], width: 8 })
  assert.throws(() => validateBoardStroke([{ x: 1, y: 1 }], BOARD_COLORS[0], 8))
  assert.throws(() => validateBoardStroke([...points, ...Array.from({ length: 499 }, () => points[0])], BOARD_COLORS[0], 8))
  assert.throws(() => validateBoardStroke([{ x: -1, y: 1 }, points[1]], BOARD_COLORS[0], 8))
  assert.throws(() => validateBoardStroke(points, 'url(https://bad.test)', 8))
  assert.throws(() => validateBoardStroke(points, BOARD_COLORS[0], 21))
})

test('pointer coordinates normalize and clamp to the responsive board bounds', () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 }
  assert.deepEqual(normalizePointerPoint(110, 70, rect), { x: 500, y: 500 })
  assert.deepEqual(normalizePointerPoint(-10, 220, rect), { x: 0, y: 1000 })
  assert.throws(() => normalizePointerPoint(10, 20, { ...rect, width: 0 }))
})

test('keyboard cursor moves in bounded steps for accessible drawing', () => {
  assert.deepEqual(moveKeyboardCursor({ x: 50, y: 50 }, 'ArrowLeft'), { x: 0, y: 50 })
  assert.deepEqual(moveKeyboardCursor({ x: 990, y: 990 }, 'ArrowDown'), { x: 990, y: 1000 })
  assert.deepEqual(moveKeyboardCursor({ x: 300, y: 300 }, 'Escape'), { x: 300, y: 300 })
})

test('board submissions are accepted only for the current generation', () => {
  assert.equal(isCurrentBoardGeneration(4, 4), true)
  assert.equal(isCurrentBoardGeneration(5, 4), false)
  assert.equal(isCurrentBoardGeneration(1, -1), false)
})
