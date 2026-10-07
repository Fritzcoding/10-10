import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarMonthCells, dateAtTimezone, localDateTimeToIso, validateCalendarEvent } from '../src/lib/calendar.ts'

test('calendar event validates timed and all-day event shape', () => {
  assert.deepEqual(validateCalendarEvent({ title: '  Dinner ', notes: '  Pasta ', allDay: true, date: '2026-10-10', timezone: 'Asia/Taipei' }), {
    title: 'Dinner', notes: 'Pasta', allDay: true, date: '2026-10-10', timezone: 'Asia/Taipei',
  })
  assert.throws(() => validateCalendarEvent({ title: ' ', notes: '', allDay: true, date: '2026-10-10', timezone: 'UTC' }), /title/i)
})

test('local timed date converts using the chosen timezone rather than device timezone', () => {
  assert.equal(localDateTimeToIso('2026-10-10T19:00', 'Asia/Taipei'), '2026-10-10T11:00:00.000Z')
  assert.equal(localDateTimeToIso('2026-10-10T19:00', 'UTC'), '2026-10-10T19:00:00.000Z')
  assert.equal(dateAtTimezone('2026-10-05T16:30:00Z', 'Asia/Taipei'), '2026-10-06')
})

test('invalid, unknown-zone, and daylight-saving-gap local times are rejected', () => {
  assert.throws(() => localDateTimeToIso('2026-03-08T02:30', 'America/Los_Angeles'), /valid local time/i)
  assert.throws(() => localDateTimeToIso('2026-10-10T19:00', 'Not/AZone'), /timezone/i)
  assert.throws(() => validateCalendarEvent({ title: 'Trip', notes: '', allDay: true, date: '2026-02-29', timezone: 'UTC' }), /date/i)
})

test('month grid includes all days with Sunday-first leading cells', () => {
  assert.equal(calendarMonthCells('2026-02-01')[0], '2026-02-01')
  assert.equal(calendarMonthCells('2026-02-01').filter(Boolean).length, 28)
})
