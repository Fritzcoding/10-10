import assert from 'node:assert/strict'
import test from 'node:test'
import { isRitualComplete, ritualWeekStart, validateCoupleRitual, validateMoodCheckin } from '../src/lib/moodRituals.ts'

test('mood check-ins accept non-clinical labels and trim bounded notes', () => {
  assert.deepEqual(validateMoodCheckin('loved', '  Long day, glad we talked.  '), { mood: 'loved', note: 'Long day, glad we talked.' })
})

test('mood check-ins reject unknown labels and oversized notes', () => {
  assert.throws(() => validateMoodCheckin('diagnosed', ''))
  assert.throws(() => validateMoodCheckin('calm', 'x'.repeat(501)))
})

test('weekly rituals trim content and require supported participation and reminder settings', () => {
  assert.deepEqual(validateCoupleRitual('  Sunday catch-up ', '  Share one good thing. ', 'both', true), { title: 'Sunday catch-up', prompt: 'Share one good thing.', participation: 'both', remindersEnabled: true })
  assert.throws(() => validateCoupleRitual(' ', '', 'both', true))
  assert.throws(() => validateCoupleRitual('Ritual', '', 'sometimes', true))
})

test('weekly ritual key starts Monday using the supplied couple-local date', () => {
  assert.equal(ritualWeekStart('2026-10-07'), '2026-10-05')
  assert.equal(ritualWeekStart('2026-10-11'), '2026-10-05')
})

test('ritual completion respects either or both participation without counting outside users', () => {
  assert.equal(isRitualComplete('either', ['a'], ['a', 'b']), true)
  assert.equal(isRitualComplete('both', ['a'], ['a', 'b']), false)
  assert.equal(isRitualComplete('both', ['a', 'b', 'other'], ['a', 'b']), true)
})
