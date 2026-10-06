import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import { DAILY_QUESTIONS, validateDailyAnswer, visibleTimelineEvents, type TimelineEvent } from '../lib/relationshipLayer'
import './Us.css'

type UsProps = { userId?: string }
type DailyQuestion = { id: string; local_date: string; prompt: string }
type DailyAnswer = { user_id: string; answer: string }
type BucketItem = { id: string; title: string; completed: boolean }
type InsideJoke = { id: string; text: string }
type UsTimelineEvent = TimelineEvent & { summary: string }

function Us({ userId }: UsProps) {
  const [coupleId, setCoupleId] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [question, setQuestion] = useState<DailyQuestion | null>(null)
  const [answers, setAnswers] = useState<DailyAnswer[]>([])
  const [bucket, setBucket] = useState<BucketItem[]>([])
  const [jokes, setJokes] = useState<InsideJoke[]>([])
  const [timeline, setTimeline] = useState<UsTimelineEvent[]>([])
  const [answer, setAnswer] = useState('')
  const [newBucket, setNewBucket] = useState('')
  const [newJoke, setNewJoke] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editingJoke, setEditingJoke] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!supabase || !userId) { setLoading(false); return }
    const { data: member, error: memberError } = await supabase.from('couple_members').select('couple_id').eq('user_id', userId).maybeSingle()
    if (memberError) { setMessage(formatSupabaseDataError(memberError)); setLoading(false); return }
    if (!member) { setCoupleId(''); setQuestion(null); setLoading(false); return }
    setCoupleId(member.couple_id)
    const [couple, daily, list, savedJokes, events] = await Promise.all([
      supabase.from('couples').select('timezone').eq('id', member.couple_id).single(),
      supabase.rpc('get_or_create_daily_question'),
      supabase.from('bucket_list_items').select('id,title,completed').eq('couple_id', member.couple_id).order('completed').order('created_at', { ascending: false }),
      supabase.from('inside_jokes').select('id,text').eq('couple_id', member.couple_id).order('created_at', { ascending: false }),
      supabase.from('relationship_timeline').select('id,pinned,hidden,created_at,summary').eq('couple_id', member.couple_id).order('created_at', { ascending: false }),
    ])
    const error = couple.error ?? daily.error ?? list.error ?? savedJokes.error ?? events.error
    if (error) {
      setMessage(formatSupabaseDataError(error))
      setLoading(false)
      return
    }
    setTimezone(couple.data!.timezone)
    setQuestion(daily.data as DailyQuestion)
    setBucket((list.data ?? []) as BucketItem[])
    setJokes((savedJokes.data ?? []) as InsideJoke[])
    setTimeline((events.data ?? []) as UsTimelineEvent[])
    const { data: savedAnswers, error: answerError } = await supabase.from('daily_question_answers').select('user_id,answer').eq('question_id', (daily.data as DailyQuestion).id)
    if (answerError) setMessage(formatSupabaseDataError(answerError))
    else setAnswers((savedAnswers ?? []) as DailyAnswer[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    queueMicrotask(() => void refresh())
    if (!supabase || !userId) return
    const client = supabase
    const dailyRefresh = window.setInterval(() => void refresh(), 60_000)
    const channel = client.channel(`relationship-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'daily_question_answers' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bucket_list_items' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inside_jokes' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'relationship_timeline' }, () => void refresh())
      .subscribe()
    return () => { window.clearInterval(dailyRefresh); void client.removeChannel(channel) }
  }, [refresh, userId])

  const run = async (action: () => Promise<unknown>, success?: string) => {
    if (!supabase) return
    setMessage('')
    try { await action(); if (success) setMessage(success); await refresh() }
    catch (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })) }
  }

  const submitAnswer = (event: FormEvent) => {
    event.preventDefault()
    if (!question) return
    try {
      const text = validateDailyAnswer(answer)
      void run(async () => {
        const { error } = await supabase!.rpc('submit_daily_question_answer', { target_question_id: question.id, target_answer: text })
        if (error) throw error
        setAnswer('')
      }, 'Your answer is saved.')
    } catch (error) { setMessage((error as Error).message) }
  }

  const addBucket = (event: FormEvent) => {
    event.preventDefault()
    const title = newBucket.trim()
    if (!title || !coupleId) return
    if (title.length > 160) { setMessage('Keep bucket-list ideas under 160 characters.'); return }
    void run(async () => {
      const { error } = await supabase!.from('bucket_list_items').insert({ couple_id: coupleId, title })
      if (error) throw error
      setNewBucket('')
    })
  }

  const addJoke = (event: FormEvent) => {
    event.preventDefault()
    const text = newJoke.trim()
    if (!text || !coupleId) return
    if (text.length > 500) { setMessage('Keep inside jokes under 500 characters.'); return }
    void run(async () => {
      const { error } = await supabase!.from('inside_jokes').insert({ couple_id: coupleId, text })
      if (error) throw error
      setNewJoke('')
    })
  }

  const saveTimezone = () => void run(async () => {
    const { error } = await supabase!.rpc('set_couple_timezone', { target_timezone: timezone.trim() })
    if (error) throw error
  }, 'Daily question timezone updated for both of you.')

  if (loading) return <section className="us-panel"><p role="status">Loading your shared space…</p></section>

  return <section className="us-panel" aria-label="Our shared space">
    <header className="us-intro"><p className="hub-panel__eyebrow">Our shared space</p><h2>Little things that are ours.</h2><p>Questions, plans, and the stories only the two of you know.</p></header>
    {!coupleId && <p className="us-empty">Pair with your partner to start your shared space.</p>}
    {coupleId && <>
      <section className="us-section" aria-labelledby="daily-question-title">
        <div className="us-section__heading"><div><p className="hub-panel__eyebrow">Today, together</p><h3 id="daily-question-title">Daily question</h3></div><small>{question?.local_date}</small></div>
        <p className="us-question">{question?.prompt ?? DAILY_QUESTIONS[0]}</p>
        <label className="us-timezone">Day changes at<input aria-label="Couple timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} list="us-timezones" /><datalist id="us-timezones"><option value="UTC" /><option value="Asia/Taipei" /><option value="Asia/Tokyo" /><option value="America/Los_Angeles" /><option value="America/New_York" /><option value="Europe/London" /><option value="Europe/Paris" /><option value="Australia/Sydney" /></datalist></label>
        <button className="us-secondary" type="button" onClick={saveTimezone}>Save timezone</button>
        {answers.length === 2 ? <div className="us-answer-reveal" role="status"><h4>Your answers</h4>{answers.map((item) => <p key={item.user_id}><strong>{item.user_id === userId ? 'You' : 'Your partner'}</strong>{item.answer}</p>)}</div>
          : answers.some((item) => item.user_id === userId) ? <p role="status">Your answer is saved. It will appear after your partner answers.</p>
            : <form className="us-form" onSubmit={submitAnswer}><label htmlFor="daily-answer">Your answer</label><textarea id="daily-answer" maxLength={1000} value={answer} onChange={(event) => setAnswer(event.target.value)} /><button type="submit">Save my answer</button></form>}
      </section>

      <section className="us-section" aria-labelledby="bucket-title"><div className="us-section__heading"><h3 id="bucket-title">Our bucket list</h3><small>{bucket.filter((item) => item.completed).length} of {bucket.length} done</small></div>
        <form className="us-inline-form" onSubmit={addBucket}><label className="sr-only" htmlFor="new-bucket-item">Add a bucket-list idea</label><input id="new-bucket-item" maxLength={160} placeholder="Something we’d love to do…" value={newBucket} onChange={(event) => setNewBucket(event.target.value)} /><button type="submit">Add</button></form>
        <ul className="us-list">{bucket.map((item) => <li key={item.id} className={item.completed ? 'is-complete' : ''}>
          <input type="checkbox" aria-label={`Mark ${item.title} ${item.completed ? 'not done' : 'done'}`} checked={item.completed} onChange={() => void run(async () => { const { error } = await supabase!.from('bucket_list_items').update({ completed: !item.completed }).eq('id', item.id); if (error) throw error })} />
          {editing === item.id ? <form className="us-edit-form" onSubmit={(event) => { event.preventDefault(); const title = editText.trim(); if (!title || title.length > 160) { setMessage('Use 1 to 160 characters.'); return } void run(async () => { const { error } = await supabase!.from('bucket_list_items').update({ title }).eq('id', item.id); if (error) throw error; setEditing(null) }) }}><input aria-label="Edit bucket item" maxLength={160} value={editText} onChange={(event) => setEditText(event.target.value)} /><button type="submit">Save</button></form>
            : <><span>{item.title}</span><button className="us-text-button" type="button" onClick={() => { setEditing(item.id); setEditText(item.title) }}>Edit</button><button className="us-text-button" type="button" onClick={() => void run(async () => { const { error } = await supabase!.from('bucket_list_items').delete().eq('id', item.id); if (error) throw error })}>Remove</button></>}
        </li>)}</ul>
        {bucket.length === 0 && <p className="us-empty">Add a little adventure to look forward to.</p>}
      </section>

      <section className="us-section" aria-labelledby="jokes-title"><h3 id="jokes-title">Inside jokes</h3><form className="us-inline-form" onSubmit={addJoke}><label className="sr-only" htmlFor="new-inside-joke">Save an inside joke</label><input id="new-inside-joke" maxLength={500} placeholder="A phrase only you two understand…" value={newJoke} onChange={(event) => setNewJoke(event.target.value)} /><button type="submit">Save</button></form>
        <ul className="us-jokes">{jokes.map((joke) => <li key={joke.id}>{editingJoke === joke.id ? <form className="us-edit-form" onSubmit={(event) => { event.preventDefault(); const text = editText.trim(); if (!text || text.length > 500) { setMessage('Use 1 to 500 characters.'); return } void run(async () => { const { error } = await supabase!.from('inside_jokes').update({ text }).eq('id', joke.id); if (error) throw error; setEditingJoke(null) }) }}><input aria-label="Edit inside joke" maxLength={500} value={editText} onChange={(event) => setEditText(event.target.value)} /><button type="submit">Save</button></form> : <><span>{joke.text}</span><button className="us-text-button" type="button" onClick={() => { setEditingJoke(joke.id); setEditText(joke.text) }}>Edit</button><button className="us-text-button" type="button" onClick={() => void run(async () => { const { error } = await supabase!.from('inside_jokes').delete().eq('id', joke.id); if (error) throw error })}>Remove</button></>}</li>)}</ul>
        {jokes.length === 0 && <p className="us-empty">Save a phrase or story you never want to forget.</p>}
      </section>

      <section className="us-section" aria-labelledby="timeline-title"><h3 id="timeline-title">Our timeline</h3><ul className="us-timeline">{visibleTimelineEvents(timeline).map((item) => <li key={item.id}><div><small>{new Date(item.created_at).toLocaleDateString()}</small><p>{item.summary}</p></div><button className="us-text-button" type="button" aria-pressed={item.pinned} onClick={() => void run(async () => { const { error } = await supabase!.from('relationship_timeline').update({ pinned: !item.pinned }).eq('id', item.id); if (error) throw error })}>{item.pinned ? 'Unpin' : 'Pin'}</button><button className="us-text-button" type="button" onClick={() => void run(async () => { const { error } = await supabase!.from('relationship_timeline').update({ hidden: true }).eq('id', item.id); if (error) throw error })}>Hide</button></li>)}</ul>
        {timeline.length === 0 && <p className="us-empty">Your shared moments will find their way here.</p>}
      </section>
    </>}
    {message && <p className="us-message" role="status">{message}</p>}
  </section>
}

export default Us
