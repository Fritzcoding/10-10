import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import { getCoupleLocalDate } from '../lib/relationshipLayer'
import { upcomingMilestones, validateMilestone, type Milestone } from '../lib/milestones'

type Props = { coupleId: string; timezone: string }
type Row = Milestone & { couple_id: string; category: string; featured: boolean; milestone_date: string }
const categories = ['anniversary', 'birthday', 'trip', 'visit', 'other']

export default function Milestones({ coupleId, timezone }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState('other')
  const [annual, setAnnual] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const today = getCoupleLocalDate(new Date(), timezone)
  const sorted = useMemo(() => upcomingMilestones(rows.map((row) => ({ ...row, date: row.milestone_date })), today), [rows, today])
  const past = rows.filter((row) => !row.annual && row.milestone_date < today)
  const featured = sorted.find((item) => item.featured) ?? sorted[0]

  const refresh = useCallback(async () => {
    const { data, error } = await supabase!.from('relationship_milestones').select('*').eq('couple_id', coupleId).order('milestone_date')
    if (error) setMessage(formatSupabaseDataError(error))
    else setRows((data ?? []) as Row[])
  }, [coupleId])
  useEffect(() => {
    queueMicrotask(() => void refresh())
    if (!supabase) return
    const client = supabase
    let channel: ReturnType<typeof client.channel> | undefined
    let cancelled = false
    void client.realtime.setAuth().then(() => {
      if (cancelled) return
      channel = client.channel(`relationship-milestones:${coupleId}`, { config: { private: true } })
        .on('broadcast', { event: '*' }, () => void refresh())
        .subscribe()
    })
    return () => { cancelled = true; if (channel) void client.removeChannel(channel) }
  }, [coupleId, refresh])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const clean = validateMilestone(title, date, annual)
      if (!supabase) return
      const request = editId
        ? supabase.from('relationship_milestones').update({ title: clean.title, milestone_date: clean.date, annual, category }).eq('id', editId)
        : supabase.from('relationship_milestones').insert({ couple_id: coupleId, title: clean.title, milestone_date: clean.date, annual, category })
      const { error } = await request
      if (error) throw error
      setTitle(''); setDate(''); setAnnual(false); setEditId(null); setMessage('Date saved for both of you.'); await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : formatSupabaseDataError(error as { message?: string | null })) }
  }
  const edit = (row: Row) => { setEditId(row.id); setTitle(row.title); setDate(row.milestone_date); setAnnual(row.annual); setCategory(row.category) }
  const remove = async (id: string) => {
    const { error } = await supabase!.from('relationship_milestones').delete().eq('id', id)
    setMessage(error ? formatSupabaseDataError(error) : 'Date removed.')
    if (!error) await refresh()
  }
  const feature = async (id: string) => {
    const { error } = await supabase!.rpc('set_featured_milestone', { target_milestone_id: id })
    setMessage(error ? formatSupabaseDataError(error) : 'Countdown updated.')
    if (!error) await refresh()
  }

  return <section className="us-section" aria-labelledby="milestones-title">
    <div className="us-section__heading"><h3 id="milestones-title">Key dates</h3><small>{timezone}</small></div>
    {featured && <div className="us-answer-reveal" aria-live="polite"><strong>{featured.title}</strong><p>{featured.daysUntil === 0 ? 'Today!' : `${featured.daysUntil} days to go`}</p></div>}
    {sorted.filter((item) => item.daysUntil <= 7).map((item) => <p key={`reminder-${item.id}`} role="status">Coming up: {item.title} {item.daysUntil === 0 ? 'today' : `in ${item.daysUntil} days`}.</p>)}
    <form className="us-form" onSubmit={(event) => void save(event)}>
      <label htmlFor="milestone-title">Date name</label><input id="milestone-title" maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Anniversary, birthday, trip…" />
      <label htmlFor="milestone-date">Date</label><input id="milestone-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
      <label htmlFor="milestone-category">Type</label><select id="milestone-category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>
      <label><input type="checkbox" checked={annual} onChange={(event) => setAnnual(event.target.checked)} /> Repeat every year</label>
      <button type="submit">{editId ? 'Save changes' : 'Add key date'}</button>{editId && <button type="button" className="us-secondary" onClick={() => { setEditId(null); setTitle(''); setDate('') }}>Cancel edit</button>}
    </form>
    <ul className="us-list milestone-list">{sorted.map((item) => { const row = rows.find((value) => value.id === item.id)!; return <li key={item.id}><span><strong>{item.title}</strong><small> · {item.occurrence} · {item.category}</small></span><div className="milestone-list__actions"><button className="us-text-button" type="button" aria-pressed={item.featured} onClick={() => void feature(item.id)}>{item.featured ? 'Countdown' : 'Choose countdown'}</button><button className="us-text-button" type="button" onClick={() => edit(row)}>Edit</button><button className="us-text-button" type="button" onClick={() => void remove(item.id)}>Remove</button></div></li> })}
      {past.map((row) => <li key={row.id}><span><strong>{row.title}</strong><small> · {row.milestone_date} · Past</small></span><div className="milestone-list__actions"><button className="us-text-button" type="button" onClick={() => edit(row)}>Edit</button><button className="us-text-button" type="button" onClick={() => void remove(row.id)}>Remove</button></div></li>)}</ul>
    {rows.length === 0 && <p className="us-empty">Add birthdays, anniversaries, trips, or visits you want to count down to.</p>}
    {message && <p className="us-message" role="status">{message}</p>}
  </section>
}
