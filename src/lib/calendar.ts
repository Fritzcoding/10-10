export type CalendarEventInput = { title: string; notes: string; allDay: boolean; date: string; timezone: string }

const parseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter a valid date.')
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Enter a valid date.')
  return parsed
}

export function validateTimezone(timezone: string) {
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format() }
  catch { throw new Error('Choose a valid timezone.') }
  return timezone
}

export function dateAtTimezone(instant: string | Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: validateTimezone(timezone), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant))
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function localDateTimeToIso(localDateTime: string, timezone: string) {
  validateTimezone(timezone)
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localDateTime)
  if (!match) throw new Error('Enter a valid local time.')
  const [, ys, ms, ds, hs, mins] = match
  const target = Date.UTC(Number(ys), Number(ms) - 1, Number(ds), Number(hs), Number(mins))
  const targetDate = new Date(target)
  if (targetDate.getUTCFullYear() !== Number(ys) || targetDate.getUTCMonth() !== Number(ms) - 1 || targetDate.getUTCDate() !== Number(ds) || Number(hs) > 23 || Number(mins) > 59) throw new Error('Enter a valid local time.')
  const formatter = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  let instant = target
  for (let i = 0; i < 5; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
    const shown = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!)
    const difference = target - shown
    if (difference === 0) return new Date(instant).toISOString()
    instant += difference
  }
  throw new Error('Enter a valid local time; this time does not exist in the selected timezone.')
}

export function validateCalendarEvent(input: CalendarEventInput) {
  const title = input.title.trim()
  const notes = input.notes.trim()
  const timezone = validateTimezone(input.timezone)
  if (!title || title.length > 160) throw new Error('Title must be 1 to 160 characters.')
  if (notes.length > 2000) throw new Error('Notes must be 2000 characters or fewer.')
  if (input.allDay) { parseDate(input.date); return { title, notes, allDay: true, date: input.date, timezone } }
  localDateTimeToIso(input.date, timezone)
  return { title, notes, allDay: false, date: input.date, timezone }
}

export function calendarMonthCells(month: string) {
  const first = parseDate(`${month.slice(0, 7)}-01`)
  const leading = first.getUTCDay()
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return [...Array<null>(leading).fill(null), ...Array.from({ length: days }, (_, index) => `${month.slice(0, 7)}-${String(index + 1).padStart(2, '0')}`)]
}
