import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import { getCoupleLocalDate } from '../lib/relationshipLayer'
import { isRitualComplete, MOOD_OPTIONS, ritualWeekStart, validateCoupleRitual, validateMoodCheckin, type Mood, type Participation } from '../lib/moodRituals'

type Props = { coupleId: string; timezone: string; userId: string }
type MoodRow = { id: string; mood: Mood; note: string; shared: boolean; created_by: string; created_at: string }
type RitualRow = { id: string; couple_id: string; title: string; prompt: string; participation_mode: Participation; reminders_enabled: boolean }
type CheckinRow = { ritual_id: string; user_id: string; week_start: string }

const moodLabels: Record<Mood, string> = { happy: 'Happy', loved: 'Loved', calm: 'Calm', okay: 'Okay', low: 'Low', stressed: 'Stressed', tired: 'Tired', excited: 'Excited' }

export default function MoodRituals({ coupleId, timezone, userId }: Props) {
  const [moods, setMoods] = useState<MoodRow[]>([])
  const [rituals, setRituals] = useState<RitualRow[]>([])
  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [members, setMembers] = useState<string[]>([userId])
  const [mood, setMood] = useState<Mood>('okay')
  const [note, setNote] = useState('')
  const [shareMood, setShareMood] = useState(false)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [participation, setParticipation] = useState<Participation>('both')
  const [remindersEnabled, setRemindersEnabled] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const localDate = getCoupleLocalDate(new Date(), timezone)
  const weekStart = ritualWeekStart(localDate)

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const [moodRows, ritualRows, checkinRows, memberRows] = await Promise.all([
      supabase.from('relationship_mood_checkins').select('id,mood,note,shared,created_by,created_at').eq('couple_id', coupleId).order('created_at', { ascending: false }),
      supabase.from('couple_rituals').select('id,couple_id,title,prompt,participation_mode,reminders_enabled').eq('couple_id', coupleId).order('created_at'),
      supabase.from('ritual_checkins').select('ritual_id,user_id,week_start').eq('couple_id', coupleId).eq('week_start', weekStart),
      supabase.from('couple_members').select('user_id').eq('couple_id', coupleId),
    ])
    const error = moodRows.error ?? ritualRows.error ?? checkinRows.error ?? memberRows.error
    if (error) setMessage(formatSupabaseDataError(error))
    else {
      setMoods((moodRows.data ?? []) as MoodRow[])
      setRituals((ritualRows.data ?? []) as RitualRow[])
      setCheckins((checkinRows.data ?? []) as CheckinRow[])
      setMembers((memberRows.data ?? []).map(({ user_id }) => user_id))
    }
    setLoading(false)
  }, [coupleId, weekStart])

  useEffect(() => {
    queueMicrotask(() => void refresh())
    if (!supabase) return
    const client = supabase
    let channel: ReturnType<typeof client.channel> | undefined
    let cancelled = false
    const refreshOnReturn = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', refreshOnReturn)
    document.addEventListener('visibilitychange', refreshOnReturn)
    void client.realtime.setAuth().then(() => {
      if (cancelled) return
      channel = client.channel(`relationship-rituals:${coupleId}`, { config: { private: true } })
        .on('broadcast', { event: '*' }, () => void refresh()).subscribe()
    })
    return () => {
      cancelled = true
      window.removeEventListener('focus', refreshOnReturn)
      document.removeEventListener('visibilitychange', refreshOnReturn)
      if (channel) void client.removeChannel(channel)
    }
  }, [coupleId, refresh])

  const saveMood = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    try {
      const clean = validateMoodCheckin(mood, note)
      const { error } = await supabase.from('relationship_mood_checkins').insert({ couple_id: coupleId, ...clean, shared: shareMood })
      if (error) throw error
      setNote('')
      setMessage(shareMood ? 'Mood shared with your partner.' : 'Mood saved privately.')
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : formatSupabaseDataError(error as { message?: string | null })) }
  }

  const removeMood = async (id: string) => {
    if (!supabase || !window.confirm('Remove this mood check-in?')) return
    const { error } = await supabase.from('relationship_mood_checkins').delete().eq('id', id)
    setMessage(error ? formatSupabaseDataError(error) : 'Mood check-in removed.')
    if (!error) await refresh()
  }

  const saveRitual = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    try {
      const clean = validateCoupleRitual(title, prompt, participation, remindersEnabled)
      const { error } = await supabase.from('couple_rituals').insert({ couple_id: coupleId, title: clean.title, prompt: clean.prompt, participation_mode: clean.participation, reminders_enabled: clean.remindersEnabled })
      if (error) throw error
      setTitle(''); setPrompt(''); setParticipation('both'); setRemindersEnabled(false)
      setMessage('Weekly ritual saved for both of you.')
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : formatSupabaseDataError(error as { message?: string | null })) }
  }

  const removeRitual = async (id: string) => {
    if (!supabase || !window.confirm('Remove this weekly ritual and its check-ins?')) return
    const { error } = await supabase.from('couple_rituals').delete().eq('id', id)
    setMessage(error ? formatSupabaseDataError(error) : 'Weekly ritual removed.')
    if (!error) await refresh()
  }

  const toggleCheckin = async (ritual: RitualRow) => {
    if (!supabase) return
    const own = checkins.find((entry) => entry.ritual_id === ritual.id && entry.user_id === userId)
    const result = own
      ? await supabase.from('ritual_checkins').delete().eq('ritual_id', ritual.id).eq('week_start', weekStart).eq('user_id', userId)
      : await supabase.from('ritual_checkins').insert({ ritual_id: ritual.id, couple_id: coupleId, week_start: weekStart })
    setMessage(result.error ? formatSupabaseDataError(result.error) : own ? 'Your check-in was removed.' : 'You checked in for this week.')
    if (!result.error) await refresh()
  }

  return <section className="us-section mood-rituals" aria-labelledby="mood-rituals-title">
    <div className="us-section__heading"><h3 id="mood-rituals-title">Moods and rituals</h3><small>{timezone}</small></div>
    <section aria-labelledby="mood-checkin-title">
      <h4 id="mood-checkin-title">How are you feeling?</h4>
      <p className="us-empty">Check in when you want. Your entry stays until you remove it.</p>
      <form className="us-form" onSubmit={(event) => void saveMood(event)}>
        <label htmlFor="mood-choice">Your mood</label>
        <select id="mood-choice" value={mood} onChange={(event) => setMood(event.target.value as Mood)}>{MOOD_OPTIONS.map((value) => <option key={value} value={value}>{moodLabels[value]}</option>)}</select>
        <label htmlFor="mood-note">Note (optional)</label>
        <textarea id="mood-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
        <label className="mood-rituals__choice"><input type="checkbox" checked={shareMood} onChange={(event) => setShareMood(event.target.checked)} /> Share this check-in with my partner</label>
        <button type="submit">Save mood check-in</button>
      </form>
      {loading ? <p role="status">Loading check-ins…</p> : moods.length === 0 ? <p className="us-empty">No check-ins yet. Share one whenever it feels right.</p> : <ul className="us-list milestone-list">{moods.map((item) => <li key={item.id}>
        <span><strong>{item.created_by === userId ? 'You' : 'Your partner'} feel {moodLabels[item.mood].toLowerCase()}</strong><small> · {item.shared ? 'Shared' : 'Private'} · {new Date(item.created_at).toLocaleDateString()}</small>{item.note && <small><br />{item.note}</small>}</span>
        {item.created_by === userId && <button className="us-text-button" type="button" onClick={() => void removeMood(item.id)}>Remove</button>}
      </li>)}</ul>}
    </section>

    <section aria-labelledby="rituals-title">
      <h4 id="rituals-title">A small weekly ritual</h4>
      <p className="us-empty">Keep a little time for each other, without streaks or pressure.</p>
      <form className="us-form" onSubmit={(event) => void saveRitual(event)}>
        <label htmlFor="ritual-title">Ritual name</label>
        <input id="ritual-title" maxLength={100} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Sunday check-in" />
        <label htmlFor="ritual-prompt">What would you like to do? (optional)</label>
        <textarea id="ritual-prompt" maxLength={500} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Share one good thing from the week." />
        <label htmlFor="ritual-participation">Participation</label>
        <select id="ritual-participation" value={participation} onChange={(event) => setParticipation(event.target.value as Participation)}><option value="both">Both of us</option><option value="either">Either of us</option></select>
        <label className="mood-rituals__choice"><input type="checkbox" checked={remindersEnabled} onChange={(event) => setRemindersEnabled(event.target.checked)} /> Show an in-app reminder each week</label>
        <button type="submit">Add weekly ritual</button>
      </form>
      {loading ? <p role="status">Loading rituals…</p> : rituals.length === 0 ? <p className="us-empty">Add a simple ritual you both enjoy.</p> : <ul className="us-list milestone-list">{rituals.map((ritual) => {
        const checkedIn = checkins.filter((item) => item.ritual_id === ritual.id).map((item) => item.user_id)
        const complete = isRitualComplete(ritual.participation_mode, checkedIn, members)
        const ownCheckin = checkedIn.includes(userId)
        return <li key={ritual.id}>
          <span><strong>{ritual.title}</strong><small> · Week of {weekStart} · {complete ? 'Complete' : 'In progress'}</small>{ritual.prompt && <small><br />{ritual.prompt}</small>}<small><br />You {ownCheckin ? 'checked in' : 'haven’t checked in'} · Your partner {checkedIn.some((id) => id !== userId) ? 'checked in' : 'hasn’t checked in'}{ritual.reminders_enabled && !complete ? ' · Reminder is on' : ''}</small>{ritual.reminders_enabled && !complete && <small role="status">This week’s ritual is ready when you are.</small>}</span>
          <div className="milestone-list__actions"><button className="us-text-button" type="button" onClick={() => void toggleCheckin(ritual)}>{ownCheckin ? 'Undo my check-in' : 'I checked in'}</button><button className="us-text-button" type="button" onClick={() => void removeRitual(ritual.id)}>Remove</button></div>
        </li>
      })}</ul>}
    </section>
    {message && <p className="us-message" role="status">{message}</p>}
  </section>
}
