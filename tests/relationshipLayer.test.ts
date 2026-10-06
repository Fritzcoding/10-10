import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canRevealDailyAnswers,
  completeBucketItem,
  dailyQuestionForDate,
  getCoupleLocalDate,
  validateDailyAnswer,
  visibleTimelineEvents,
} from '../src/lib/relationshipLayer.ts'

test('couple local date follows the configured timezone across UTC midnight', () => {
  assert.equal(getCoupleLocalDate(new Date('2026-10-05T16:30:00Z'), 'Asia/Taipei'), '2026-10-06')
  assert.equal(getCoupleLocalDate(new Date('2026-10-05T16:30:00Z'), 'UTC'), '2026-10-05')
})

test('daily question is stable for a couple and date and rotates for the next date', () => {
  const prompts = ['A', 'B', 'C', 'D', 'E']
  const today = dailyQuestionForDate(prompts, 'couple-one', '2026-10-05')
  assert.equal(dailyQuestionForDate(prompts, 'couple-one', '2026-10-05'), today)
  assert.ok(prompts.includes(today))
  assert.notEqual(dailyQuestionForDate(prompts, 'couple-one', '2026-10-06'), today)
  assert.notEqual(dailyQuestionForDate(prompts, 'couple-two', '2026-10-05'), today)
})

test('daily answers are trimmed and must have content within the limit', () => {
  assert.equal(validateDailyAnswer('  I felt cared for.  '), 'I felt cared for.')
  assert.throws(() => validateDailyAnswer('   '), /answer/i)
  assert.throws(() => validateDailyAnswer('x'.repeat(1001)), /1000/)
})

test('daily answers reveal only after both partners have submitted', () => {
  assert.equal(canRevealDailyAnswers(0), false)
  assert.equal(canRevealDailyAnswers(1), false)
  assert.equal(canRevealDailyAnswers(2), true)
})

test('bucket completion toggles without mutating its input', () => {
  const item = { id: 'item-1', completed: false }
  assert.deepEqual(completeBucketItem(item), { id: 'item-1', completed: true })
  assert.equal(item.completed, false)
})

test('timeline hides dismissed events and sorts pinned events first', () => {
  const events = [
    { id: 'older', pinned: false, hidden: false, created_at: '2026-10-01T00:00:00Z' },
    { id: 'newer', pinned: false, hidden: false, created_at: '2026-10-04T00:00:00Z' },
    { id: 'pinned', pinned: true, hidden: false, created_at: '2026-09-01T00:00:00Z' },
    { id: 'hidden', pinned: true, hidden: true, created_at: '2026-10-05T00:00:00Z' },
  ]
  assert.deepEqual(visibleTimelineEvents(events).map(({ id }) => id), ['pinned', 'newer', 'older'])
})
