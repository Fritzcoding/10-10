import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DRAWING_DURATION_PRESETS,
  canRevealDrawing,
  drawingObjectPath,
  validateDrawingDuration,
  validateDrawingImage,
} from '../src/lib/drawingGame.ts'

const SESSION = 'f0000000-0000-4000-8000-000000000001'
const USER = 'f0000000-0000-4000-8000-000000000002'

test('drawing timer presets match the roadmap', () => {
  assert.deepEqual(DRAWING_DURATION_PRESETS, [15, 30, 60, 180, 300])
})

test('custom drawing durations are whole seconds from 15 through 600', () => {
  assert.equal(validateDrawingDuration(15), 15)
  assert.equal(validateDrawingDuration(600), 600)
  assert.throws(() => validateDrawingDuration(14), /15 and 600/)
  assert.throws(() => validateDrawingDuration(601), /15 and 600/)
  assert.throws(() => validateDrawingDuration(30.5), /whole number/)
})

test('drawing submission reveals after both partners submit or the deadline', () => {
  const deadline = new Date('2026-10-05T12:00:00Z')
  assert.equal(canRevealDrawing(1, deadline, new Date('2026-10-05T11:59:59Z')), false)
  assert.equal(canRevealDrawing(2, deadline, new Date('2026-10-05T11:59:59Z')), true)
  assert.equal(canRevealDrawing(1, deadline, deadline), true)
})

test('reference and drawing objects use session- and user-scoped private paths', () => {
  assert.equal(drawingObjectPath(SESSION, 'reference', 'image/webp'), `${SESSION}/reference.webp`)
  assert.equal(drawingObjectPath(SESSION, 'drawing', 'image/png', USER), `${SESSION}/drawings/${USER}.png`)
  assert.throws(() => drawingObjectPath('invalid', 'reference', 'image/png'), /session id/i)
  assert.throws(() => drawingObjectPath(SESSION, 'drawing', 'image/jpeg'), /png/i)
})

test('reference images accept only JPEG PNG or WebP up to 5 MiB', () => {
  assert.equal(validateDrawingImage('image/jpeg', 5 * 1024 * 1024), true)
  assert.equal(validateDrawingImage('image/png', 100), true)
  assert.equal(validateDrawingImage('image/webp', 100), true)
  assert.equal(validateDrawingImage('image/gif', 100), false)
  assert.equal(validateDrawingImage('image/png', 5 * 1024 * 1024 + 1), false)
})
