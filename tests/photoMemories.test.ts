import test from 'node:test'
import assert from 'node:assert/strict'
import { onThisDayMemories, validatePhotoMemory } from '../src/lib/photoMemories.ts'

test('photo memory accepts supported non-empty image under 5 MiB and trims caption', () => {
  assert.deepEqual(validatePhotoMemory({ type: 'image/jpeg', size: 1 }, '  Our first trip  ', '2025-10-07'), { caption: 'Our first trip', date: '2025-10-07' })
})

test('photo memory rejects unsupported, empty, oversized files and invalid metadata', () => {
  assert.throws(() => validatePhotoMemory({ type: 'image/gif', size: 1 }, '', '2025-10-07'), /JPEG, PNG, or WebP/i)
  assert.throws(() => validatePhotoMemory({ type: 'image/png', size: 0 }, '', '2025-10-07'), /empty/i)
  assert.throws(() => validatePhotoMemory({ type: 'image/webp', size: 5 * 1024 * 1024 + 1 }, '', '2025-10-07'), /5 MiB/i)
  assert.throws(() => validatePhotoMemory({ type: 'image/png', size: 1 }, 'x'.repeat(501), '2025-10-07'), /500/i)
  assert.throws(() => validatePhotoMemory({ type: 'image/png', size: 1 }, '', '2025-02-29'), /date/i)
})

test('on this day returns only memories from prior years with the same month and day', () => {
  const rows = [{ id: 'old', date: '2025-10-07' }, { id: 'older', date: '2023-10-07' }, { id: 'today', date: '2026-10-07' }, { id: 'other-day', date: '2025-10-08' }]
  assert.deepEqual(onThisDayMemories(rows, '2026-10-07').map(({ id }) => id), ['old', 'older'])
})
