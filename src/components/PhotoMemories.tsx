import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import { onThisDayMemories, validatePhotoMemory } from '../lib/photoMemories'
import { dateAtTimezone } from '../lib/calendar'

type TimelineEntry = { id: string; summary: string }
type PhotoMemoryRow = { id: string; object_path: string; caption: string; memory_date: string; timeline_event_id: string | null; created_at: string }
type PhotoMemory = PhotoMemoryRow & { imageUrl: string }
type Props = { coupleId: string; timezone: string; timeline: TimelineEntry[] }

function PhotoMemories({ coupleId, timezone, timeline }: Props) {
  const [memories, setMemories] = useState<PhotoMemory[]>([])
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState(() => dateAtTimezone(new Date(), timezone))
  const [timelineEventId, setTimelineEventId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const today = useMemo(() => dateAtTimezone(new Date(), timezone), [timezone])

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data, error } = await supabase.from('photo_memories').select('id,object_path,caption,memory_date,timeline_event_id,created_at').eq('couple_id', coupleId).order('memory_date', { ascending: false })
    if (error) { setMessage(formatSupabaseDataError(error)); setLoading(false); return }
    const rows = (data ?? []) as PhotoMemoryRow[]
    const withUrls = await Promise.all(rows.map(async (row) => {
      const { data: photo, error: photoError } = await supabase!.storage.from('couple-memories').download(row.object_path)
      if (photoError) throw photoError
      return { ...row, imageUrl: URL.createObjectURL(photo) }
    }))
    setMemories(withUrls)
    setLoading(false)
  }, [coupleId])

  useEffect(() => () => { memories.forEach(({ imageUrl }) => URL.revokeObjectURL(imageUrl)) }, [memories])

  useEffect(() => {
    queueMicrotask(() => { void refresh().catch((error) => { setMessage(formatSupabaseDataError(error)); setLoading(false) }) })
    if (!supabase) return
    const client = supabase
    const channel = client.channel(`photo-memories:${coupleId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'photo_memories', filter: `couple_id=eq.${coupleId}` }, () => {
      void refresh().catch((error) => setMessage(formatSupabaseDataError(error)))
    }).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [coupleId, refresh])

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const file = (form.elements.namedItem('photo-file') as HTMLInputElement).files?.[0]
    if (!file || !supabase) { setMessage('Choose a photo first.'); return }
    let details: ReturnType<typeof validatePhotoMemory>
    try { details = validatePhotoMemory(file, caption, date) }
    catch (error) { setMessage((error as Error).message); return }

    setSaving(true)
    setMessage('')
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
    const objectPath = `${coupleId}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('couple-memories').upload(objectPath, file, { contentType: file.type, upsert: false })
    if (uploadError) { setMessage(formatSupabaseDataError(uploadError)); setSaving(false); return }
    const { error: insertError } = await supabase.from('photo_memories').insert({ couple_id: coupleId, object_path: objectPath, caption: details.caption, memory_date: details.date, timeline_event_id: timelineEventId || null })
    if (insertError) {
      await supabase.storage.from('couple-memories').remove([objectPath])
      setMessage(formatSupabaseDataError(insertError))
      setSaving(false)
      return
    }
    setCaption('')
    setTimelineEventId('')
    form.reset()
    await refresh()
    setMessage('Photo memory saved.')
    setSaving(false)
  }

  const updateMemory = async (memory: PhotoMemory, patch: Partial<Pick<PhotoMemoryRow, 'caption' | 'memory_date' | 'timeline_event_id'>>) => {
    if (!supabase) return
    const { error } = await supabase.from('photo_memories').update(patch).eq('id', memory.id)
    if (error) { setMessage(formatSupabaseDataError(error)); return }
    await refresh()
  }

  const removeMemory = async (memory: PhotoMemory) => {
    if (!supabase || !window.confirm('Remove this photo memory for both of you?')) return
    const { error: rowError } = await supabase.from('photo_memories').delete().eq('id', memory.id)
    if (rowError) { setMessage(formatSupabaseDataError(rowError)); return }
    const { error: fileError } = await supabase.storage.from('couple-memories').remove([memory.object_path])
    await refresh()
    setMessage(fileError ? 'Memory removed, but its photo could not be deleted from storage.' : 'Photo memory removed.')
  }

  const pastMemories = onThisDayMemories(memories.map((memory) => ({ date: memory.memory_date, memory })), today)

  return <section className="us-section photo-memories" aria-labelledby="photo-memories-title">
    <div className="us-section__heading"><h3 id="photo-memories-title">Photo memories</h3><span>{memories.length}</span></div>
    <form className="us-form" onSubmit={(event) => void upload(event)}>
      <label htmlFor="photo-file">Choose a photo (JPEG, PNG, or WebP; up to 5 MiB)</label>
      <input id="photo-file" name="photo-file" type="file" accept="image/jpeg,image/png,image/webp" required />
      <label htmlFor="photo-caption">Caption (optional)</label>
      <input id="photo-caption" maxLength={500} value={caption} onChange={(event) => setCaption(event.target.value)} />
      <label htmlFor="photo-date">Memory date</label>
      <input id="photo-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
      <label htmlFor="photo-timeline-link">Link to a timeline entry (optional)</label>
      <select id="photo-timeline-link" value={timelineEventId} onChange={(event) => setTimelineEventId(event.target.value)}><option value="">No timeline link</option>{timeline.map((entry) => <option key={entry.id} value={entry.id}>{entry.summary}</option>)}</select>
      <button type="submit" disabled={saving}>{saving ? 'Saving photo…' : 'Save photo memory'}</button>
    </form>
    {loading ? <p role="status">Loading photo memories…</p> : memories.length === 0 ? <p className="us-empty">Save a photo from a day you want to keep.</p> : <>
      {pastMemories.length > 0 && <div className="photo-memories__anniversary"><h4>On this day</h4><ul className="photo-memories__grid">{pastMemories.map(({ memory }) => <li key={memory.id}><img src={memory.imageUrl} alt={memory.caption || `Photo from ${memory.memory_date}`} loading="lazy" /><p>{memory.caption || 'A memory from this day'}</p><small>{memory.memory_date}</small></li>)}</ul></div>}
      <ul className="photo-memories__grid">{memories.map((memory) => <li key={memory.id}>
        <img src={memory.imageUrl} alt={memory.caption || `Photo from ${memory.memory_date}`} loading="lazy" />
        <label htmlFor={`memory-caption-${memory.id}`}>Caption</label><input id={`memory-caption-${memory.id}`} maxLength={500} defaultValue={memory.caption} onBlur={(event) => { if (event.target.value.trim() !== memory.caption) void updateMemory(memory, { caption: event.target.value.trim() }) }} />
        <label htmlFor={`memory-date-${memory.id}`}>Memory date</label><input id={`memory-date-${memory.id}`} type="date" defaultValue={memory.memory_date} onBlur={(event) => { if (event.target.value !== memory.memory_date) void updateMemory(memory, { memory_date: event.target.value }) }} />
        <label htmlFor={`memory-link-${memory.id}`}>Timeline entry</label><select id={`memory-link-${memory.id}`} value={memory.timeline_event_id ?? ''} onChange={(event) => void updateMemory(memory, { timeline_event_id: event.target.value || null })}><option value="">No timeline link</option>{timeline.map((entry) => <option key={entry.id} value={entry.id}>{entry.summary}</option>)}</select>
        <button className="us-text-button" type="button" onClick={() => void removeMemory(memory)}>Remove photo</button>
      </li>)}</ul>
    </>}
    {message && <p className="us-message" role="status">{message}</p>}
  </section>
}

export default PhotoMemories
