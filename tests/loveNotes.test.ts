import test from 'node:test'
import assert from 'node:assert/strict'
import { validateLoveNote, validateVoiceMemo } from '../src/lib/loveNotes.ts'

test('love note trims text and enforces the content limit', () => {
  assert.equal(validateLoveNote('  I love our rainy walks.  '), 'I love our rainy walks.')
  assert.throws(() => validateLoveNote('  '), /at least one character/i)
  assert.throws(() => validateLoveNote('x'.repeat(2001)), /2000/)
})

test('voice memo accepts supported audio within size and duration bounds', () => {
  assert.deepEqual(validateVoiceMemo({ type: 'audio/webm', size: 10 }, 60_000), { durationMs: 60_000 })
  assert.deepEqual(validateVoiceMemo({ type: 'audio/mp4', size: 10 }, 1_000), { durationMs: 1_000 })
})

test('voice memo rejects invalid type, empty or oversized files and out-of-range duration', () => {
  assert.throws(() => validateVoiceMemo({ type: 'video/webm', size: 10 }, 10_000), /audio/i)
  assert.throws(() => validateVoiceMemo({ type: 'audio/webm', size: 0 }, 10_000), /empty/i)
  assert.throws(() => validateVoiceMemo({ type: 'audio/ogg', size: 5 * 1024 * 1024 + 1 }, 10_000), /5 MiB/i)
  assert.throws(() => validateVoiceMemo({ type: 'audio/webm', size: 10 }, 60_001), /60 seconds/i)
  assert.throws(() => validateVoiceMemo({ type: 'audio/webm', size: 10 }, 0), /duration/i)
})
