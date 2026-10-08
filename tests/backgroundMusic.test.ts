import test from 'node:test'
import assert from 'node:assert/strict'
import { isSupportedBackgroundMusic } from '../src/lib/musicPreferences.ts'

test('background music accepts audio files up to 25 MB', () => {
  assert.equal(isSupportedBackgroundMusic({ type: 'audio/mpeg', size: 25 * 1024 * 1024 }), true)
  assert.equal(isSupportedBackgroundMusic({ type: 'audio/mp4', size: 1 }), true)
})

test('background music rejects non-audio, empty, and oversized files', () => {
  assert.equal(isSupportedBackgroundMusic({ type: 'image/png', size: 50 }), false)
  assert.equal(isSupportedBackgroundMusic({ type: 'audio/ogg', size: 0 }), false)
  assert.equal(isSupportedBackgroundMusic({ type: 'audio/wav', size: 25 * 1024 * 1024 + 1 }), false)
})
