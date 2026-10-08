import test from 'node:test'
import assert from 'node:assert/strict'
import { validateScheduledSurprise, US_SECTION_LINKS, type SurpriseType } from '../src/lib/scheduledSurprises.ts'

const future = new Date('2026-10-09T12:00:00.000Z')

test('scheduled surprise trims valid text and preserves the requested type', () => {
  assert.deepEqual(validateScheduledSurprise('note', '  A little note  ', future, new Date('2026-10-08T12:00:00Z')),
    { type: 'note', payload: { text: 'A little note' }, releaseAt: future.toISOString() })
})

test('scheduled surprise rejects invalid type, empty or oversized text, and non-future time', () => {
  assert.throws(() => validateScheduledSurprise('unknown' as SurpriseType, 'text', future, new Date('2026-10-08T12:00:00Z')), /type/i)
  assert.throws(() => validateScheduledSurprise('question', '  ', future, new Date('2026-10-08T12:00:00Z')), /text/i)
  assert.throws(() => validateScheduledSurprise('activity', 'x'.repeat(2001), future, new Date('2026-10-08T12:00:00Z')), /2000/)
  assert.throws(() => validateScheduledSurprise('challenge', 'Try this', new Date('2026-10-08T12:00:00Z'), new Date('2026-10-08T12:00:00Z')), /future/i)
})

test('surprise photo payload requires a selected supported image', () => {
  assert.throws(() => validateScheduledSurprise('photo', '', future, new Date('2026-10-08T12:00:00Z')), /photo/i)
  assert.throws(() => validateScheduledSurprise('photo', '', future, new Date('2026-10-08T12:00:00Z'), { type: 'image/gif', size: 50 }), /JPEG/i)
  assert.deepEqual(validateScheduledSurprise('photo', 'Us at the beach', future, new Date('2026-10-08T12:00:00Z'), { type: 'image/webp', size: 100 }),
    { type: 'photo', payload: { text: 'Us at the beach' }, releaseAt: future.toISOString() })
})

test('Us navigation exposes one in-page target for every shared feature', () => {
  const ids = new Set(US_SECTION_LINKS.map(({ id }) => id))
  assert.equal(ids.size, 12)
  assert.ok(ids.has('us-daily-question'))
  assert.ok(ids.has('us-surprises'))
  assert.ok(ids.has('us-timeline'))
})
