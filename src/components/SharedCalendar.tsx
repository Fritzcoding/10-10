import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import { calendarMonthCells, dateAtTimezone, localDateTimeToIso, validateCalendarEvent } from '../lib/calendar'
import './Us.css'

type Props = { coupleId: string; timezone: string }
type EventRow = { id: string; title: string; notes: string; timezone: string; all_day: boolean; event_date: string | null; starts_at: string | null; ends_at: string | null; milestone_id: string | null; wishlist_item_id: string | null }
type ReferenceRow = { id: string; title: string }
const zones = ['UTC', 'Asia/Taipei', 'Asia/Tokyo', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Australia/Sydney']
const dayKey = (event: EventRow) => event.all_day ? event.event_date! : dateAtTimezone(event.starts_at!, event.timezone)
const localInput = (instant: string, zone: string) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant))
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

export default function SharedCalendar({ coupleId, timezone: defaultTimezone }: Props) {
  const today = dateAtTimezone(new Date(), defaultTimezone)
  const [events, setEvents] = useState<EventRow[]>([])
  const [milestones, setMilestones] = useState<ReferenceRow[]>([])
  const [ideas, setIdeas] = useState<ReferenceRow[]>([])
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`)
  const [selected, setSelected] = useState(today)
  const [view, setView] = useState<'month' | 'agenda'>('month')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [timezone, setTimezone] = useState(defaultTimezone)
  const [allDay, setAllDay] = useState(true)
  const [eventDate, setEventDate] = useState(today)
  const [startsAt, setStartsAt] = useState('')
  const [milestoneId, setMilestoneId] = useState('')
  const [wishlistId, setWishlistId] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    const [eventRows, milestoneRows, ideaRows] = await Promise.all([
      supabase!.from('relationship_events').select('*').eq('couple_id', coupleId),
      supabase!.from('relationship_milestones').select('id,title').eq('couple_id', coupleId),
      supabase!.from('bucket_list_items').select('id,title').eq('couple_id', coupleId).eq('completed', false),
    ])
    const error = eventRows.error ?? milestoneRows.error ?? ideaRows.error
    if (error) setMessage(formatSupabaseDataError(error))
    else { setEvents((eventRows.data ?? []) as EventRow[]); setMilestones((milestoneRows.data ?? []) as ReferenceRow[]); setIdeas((ideaRows.data ?? []) as ReferenceRow[]) }
  }, [coupleId, setEvents, setIdeas, setMessage, setMilestones])
  useEffect(() => {
    queueMicrotask(() => void refresh())
    if (!supabase) return
    const client = supabase
    let channel: ReturnType<typeof client.channel> | undefined
    let cancelled = false
    void client.realtime.setAuth().then(() => {
      if (cancelled) return
      channel = client.channel(`shared-calendar:${coupleId}`, { config: { private: true } })
        .on('broadcast', { event: '*' }, () => void refresh()).subscribe()
    })
    return () => { cancelled = true; if (channel) void client.removeChannel(channel) }
  }, [coupleId, refresh])

  const cells = useMemo(() => calendarMonthCells(month), [month])
  const dayEvents = events.filter((event) => dayKey(event) === selected).sort((a, b) => (a.starts_at ?? a.event_date ?? '').localeCompare(b.starts_at ?? b.event_date ?? ''))
  const agenda = [...events].filter((event) => dayKey(event) >= today).sort((a, b) => dayKey(a).localeCompare(dayKey(b)))
  const resetForm = () => { setTitle(''); setNotes(''); setAllDay(true); setEventDate(selected); setStartsAt(''); setMilestoneId(''); setWishlistId(''); setEditing(null) }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const clean = validateCalendarEvent({ title, notes, allDay, date: allDay ? eventDate : startsAt, timezone })
      const values = { couple_id: coupleId, title: clean.title, notes: clean.notes, timezone, all_day: allDay, event_date: allDay ? eventDate : null, starts_at: allDay ? null : localDateTimeToIso(startsAt, timezone), ends_at: null, milestone_id: milestoneId || null, wishlist_item_id: wishlistId || null }
      if (!supabase) return
      const request = editing ? supabase.from('relationship_events').update(values).eq('id', editing) : supabase.from('relationship_events').insert(values)
      const { error } = await request
      if (error) throw error
      setMessage('Plan saved for both of you.'); resetForm(); await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : formatSupabaseDataError(error as { message?: string | null })) }
  }
  const edit = (event: EventRow) => { const date = dayKey(event); setEditing(event.id); setTitle(event.title); setNotes(event.notes); setTimezone(event.timezone); setAllDay(event.all_day); setEventDate(date); setSelected(date); setMonth(`${date.slice(0, 7)}-01`); setStartsAt(event.starts_at ? localInput(event.starts_at, event.timezone) : ''); setMilestoneId(event.milestone_id ?? ''); setWishlistId(event.wishlist_item_id ?? '') }
  const remove = async (id: string) => { const { error } = await supabase!.from('relationship_events').delete().eq('id', id); setMessage(error ? formatSupabaseDataError(error) : 'Plan removed.'); if (!error) await refresh() }
  const changeMonth = (amount: number) => { const date = new Date(`${month}T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + amount); const nextMonth = `${date.toISOString().slice(0, 7)}-01`; setMonth(nextMonth); setSelected(nextMonth); setEventDate(nextMonth) }

  return <section className="us-section shared-calendar" aria-labelledby="calendar-title">
    <div className="us-section__heading"><h3 id="calendar-title">Shared calendar</h3><div><button className="us-text-button" type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>Month</button><button className="us-text-button" type="button" aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}>Upcoming</button></div></div>
    {view === 'month' ? <><div className="calendar-month"><button className="us-secondary" type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button><strong>{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}T00:00:00Z`))}</strong><button className="us-secondary" type="button" aria-label="Next month" onClick={() => changeMonth(1)}>›</button></div>
      <div className="calendar-grid" role="grid" aria-label="Calendar month"><div className="calendar-grid__weekdays">{'SMTWTFS'.split('').map((day, i) => <span key={`${day}-${i}`}>{day}</span>)}</div><div className="calendar-grid__days">{cells.map((day, i) => day ? <button key={day} type="button" role="gridcell" aria-label={`${day}${events.some((e) => dayKey(e) === day) ? ', has plans' : ''}`} aria-pressed={selected === day} className={events.some((e) => dayKey(e) === day) ? 'has-events' : ''} onClick={() => { setSelected(day); setEventDate(day) }}>{Number(day.slice(-2))}</button> : <span key={`empty-${i}`} aria-hidden="true" />)}</div></div>
      <h4>{selected} plans</h4><ul className="us-list">{dayEvents.map((event) => <li key={event.id}><span><strong>{event.title}</strong><small> · {event.all_day ? 'All day' : new Intl.DateTimeFormat(undefined, { timeZone: event.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(event.starts_at!))} · {event.timezone}</small>{event.notes && <small><br />{event.notes}</small>}</span><div className="milestone-list__actions"><button className="us-text-button" type="button" onClick={() => edit(event)}>Edit</button><button className="us-text-button" type="button" onClick={() => void remove(event.id)}>Remove</button></div></li>)}</ul>
    </> : <ul className="us-list">{agenda.map((event) => <li key={event.id}><span><strong>{event.title}</strong><small> · {dayKey(event)} · {event.all_day ? 'All day' : new Intl.DateTimeFormat(undefined, { timeZone: event.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(event.starts_at!))}</small></span><div className="milestone-list__actions"><button className="us-text-button" type="button" onClick={() => { edit(event); setView('month') }}>Edit</button><button className="us-text-button" type="button" onClick={() => void remove(event.id)}>Remove</button></div></li>)}</ul>}
    <form className="us-form" onSubmit={(event) => void save(event)}>
      <h4>{editing ? 'Edit plan' : 'Add a plan'}</h4><label htmlFor="calendar-event-title">Title</label><input id="calendar-event-title" maxLength={160} required value={title} onChange={(event) => setTitle(event.target.value)} />
      <label htmlFor="calendar-event-notes">Notes (optional)</label><textarea id="calendar-event-notes" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
      <label><input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} /> All day</label>
      <label htmlFor="calendar-event-date">{allDay ? 'Date' : 'Start time'}</label><input id="calendar-event-date" type={allDay ? 'date' : 'datetime-local'} required value={allDay ? eventDate : startsAt} onChange={(event) => { if (allDay) { setEventDate(event.target.value); setSelected(event.target.value); setMonth(`${event.target.value.slice(0, 7)}-01`) } else setStartsAt(event.target.value) }} />
      {!allDay && <><label htmlFor="calendar-timezone">Timezone</label><select id="calendar-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>{[...new Set([defaultTimezone, ...zones])].map((zone) => <option key={zone}>{zone}</option>)}</select></>}
      <label htmlFor="calendar-milestone">Related key date (optional)</label><select id="calendar-milestone" value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)}><option value="">None</option>{milestones.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select>
      <label htmlFor="calendar-wishlist">Related wishlist idea (optional)</label><select id="calendar-wishlist" value={wishlistId} onChange={(event) => setWishlistId(event.target.value)}><option value="">None</option>{ideas.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select>
      <button type="submit">{editing ? 'Save plan' : 'Add to calendar'}</button>{editing && <button className="us-secondary" type="button" onClick={resetForm}>Cancel edit</button>}
    </form>
    {message && <p role="status" className="us-message">{message}</p>}
  </section>
}
