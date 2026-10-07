import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getMilestoneOccurrence,
  getDaysUntilMilestone,
  validateMilestone,
  upcomingMilestones,
} from '../src/lib/milestones.ts'

const milestone = { id: 'm1', title: 'Anniversary', date: '2024-10-10', annual: true }

test('milestone validation trims title and accepts a valid date', () => {
  assert.deepEqual(validateMilestone('  Our anniversary ', '2026-10-10', true), { title: 'Our anniversary', date: '2026-10-10', annual: true })
})

test('milestone rejects blank title, impossible dates, and malformed dates', () => {
  assert.throws(() => validateMilestone('  ', '2026-10-10', false), /title/i)
  assert.throws(() => validateMilestone('Trip', '2026-02-29', true), /date/i)
  assert.throws(() => validateMilestone('Trip', '10/10/2026', true), /date/i)
})

test('annual milestone rolls to the next year and maps Feb 29 to Feb 28 in common years', () => {
  assert.equal(getMilestoneOccurrence(milestone, '2026-10-11'), '2027-10-10')
  assert.equal(getMilestoneOccurrence({ ...milestone, date: '2024-02-29' }, '2025-01-01'), '2025-02-28')
})

test('countdown uses local calendar dates rather than elapsed hours', () => {
  assert.equal(getDaysUntilMilestone('2026-10-07', '2026-10-06'), 1)
  assert.equal(getDaysUntilMilestone('2026-10-06', '2026-10-06'), 0)
})

test('upcoming milestones are ordered by next occurrence and exclude past one-time dates', () => {
  const result = upcomingMilestones([
    { id: 'later', title: 'Later', date: '2026-10-20', annual: false },
    { id: 'past', title: 'Past', date: '2026-10-01', annual: false },
    { id: 'annual', title: 'Annual', date: '2024-10-08', annual: true },
  ], '2026-10-06')
  assert.deepEqual(result.map(({ id, daysUntil }) => [id, daysUntil]), [['annual', 2], ['later', 14]])
})
