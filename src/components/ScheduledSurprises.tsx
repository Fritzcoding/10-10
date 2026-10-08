import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import { SURPRISE_TYPES, validateScheduledSurprise, type SurpriseType } from '../lib/scheduledSurprises'

type ReleasedSurprise = { id: string; created_by: string; surprise_type: SurpriseType; release_at: string; payload: { text: string }; photo_path: string | null; photo_url?: string }
type PendingSurprise = { id: string; surprise_type: SurpriseType; release_at: string; photo_path: string | null }

const BUCKET = 'scheduled-surprise-photos'
const labels: Record<SurpriseType, string> = { note: 'A note', question: 'A question', photo: 'A photo', challenge: 'A challenge', activity: 'An activity' }

function localDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

function ScheduledSurprises({ userId }: { userId: string }) {
  const [type, setType] = useState<SurpriseType>('note')
  const [text, setText] = useState('')
  const [releaseAt, setReleaseAt] = useState(() => localDateTime(new Date(Date.now() + 60 * 60_000)))
  const [photo, setPhoto] = useState<File>()
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [released, setReleased] = useState<ReleasedSurprise[]>([])
  const [pending, setPending] = useState<PendingSurprise[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const [releasedResult, pendingResult] = await Promise.all([
      supabase.rpc('get_released_surprises'),
      supabase.rpc('get_my_pending_surprises'),
    ])
    const loadError = releasedResult.error ?? pendingResult.error
    if (loadError) {
      setMessage(formatSupabaseDataError(loadError))
      setLoading(false)
      return
    }
    const rows = (releasedResult.data ?? []) as ReleasedSurprise[]
    const withPhotos = await Promise.all(rows.map(async (item) => {
      if (!item.photo_path) return item
      const { data, error } = await supabase!.storage.from(BUCKET).createSignedUrl(item.photo_path, 3600)
      return error ? item : { ...item, photo_url: data.signedUrl }
    }))
    setReleased(withPhotos)
    setPending((pendingResult.data ?? []) as PendingSurprise[])
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => void refresh())
    const timer = window.setInterval(() => void refresh(), 30_000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [refresh])

  async function schedule(event: FormEvent) {
    event.preventDefault()
    if (!supabase) { setMessage('Supabase is not configured.'); return }
    let surprise
    try { surprise = validateScheduledSurprise(type, text, new Date(releaseAt), new Date(), photo) }
    catch (error) { setMessage((error as Error).message); return }
    setSaving(true)
    setMessage('')
    let photoPath: string | null = null
    try {
      if (type === 'photo' && photo) {
        const extension = photo.type === 'image/jpeg' ? 'jpg' : photo.type === 'image/png' ? 'png' : 'webp'
        photoPath = uploadedPhotoPath ?? `${requestId}/${requestId}.${extension}`
        if (!uploadedPhotoPath) {
          const { error } = await supabase.storage.from(BUCKET).upload(photoPath, photo, { contentType: photo.type })
          if (error) throw error
          setUploadedPhotoPath(photoPath)
        }
      }
      const { error } = await supabase.rpc('schedule_surprise', {
        target_id: requestId,
        target_type: surprise.type,
        target_release_at: surprise.releaseAt,
        target_payload: surprise.payload,
        target_photo_path: photoPath,
      })
      if (error) throw error
      setText('')
      setPhoto(undefined)
      setUploadedPhotoPath(null)
      setRequestId(crypto.randomUUID())
      setMessage('Surprise scheduled. Its contents will stay private until release.')
      await refresh()
    } catch (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })) }
    finally { setSaving(false) }
  }

  async function cancel(item: PendingSurprise) {
    if (!supabase) return
    setMessage('')
    const { error } = await supabase.rpc('cancel_scheduled_surprise', { target_id: item.id })
    if (error) { setMessage(formatSupabaseDataError(error)); return }
    if (item.photo_path) {
      const removed = await supabase.storage.from(BUCKET).remove([item.photo_path])
      if (removed.error) setMessage('Surprise cancelled. Its private photo could not be cleaned up yet.')
    }
    await refresh()
  }

  if (loading) return <section className="us-section" aria-labelledby="surprises-title"><h3 id="surprises-title">Scheduled surprises</h3><p role="status">Loading your surprises…</p></section>

  return <section className="us-section scheduled-surprises" aria-labelledby="surprises-title">
    <div className="us-section__heading"><div><p className="hub-panel__eyebrow">A little something later</p><h3 id="surprises-title">Scheduled surprises</h3></div></div>
    <p>Write or choose something now; it stays hidden until its release time.</p>
    <form className="us-form" onSubmit={(event) => void schedule(event)}>
      <label htmlFor="surprise-type">Surprise</label>
      <select id="surprise-type" value={type} onChange={(event) => setType(event.target.value as SurpriseType)} disabled={saving}>{SURPRISE_TYPES.map((item) => <option value={item} key={item}>{labels[item]}</option>)}</select>
      {type === 'photo' ? <>
        <label htmlFor="surprise-photo">Choose a photo (JPEG, PNG, or WebP; up to 8 MB)</label>
        <input id="surprise-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setPhoto(event.target.files?.[0]); if (uploadedPhotoPath) setRequestId(crypto.randomUUID()); setUploadedPhotoPath(null) }} disabled={saving} />
        <label htmlFor="surprise-text">Caption (optional)</label>
        <input id="surprise-text" maxLength={500} value={text} onChange={(event) => setText(event.target.value)} disabled={saving} />
      </> : <>
        <label htmlFor="surprise-text">What should they see?</label>
        <textarea id="surprise-text" maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} disabled={saving} />
      </>}
      <label htmlFor="surprise-release">Release at</label>
      <input id="surprise-release" type="datetime-local" value={releaseAt} onChange={(event) => setReleaseAt(event.target.value)} disabled={saving} />
      <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Schedule surprise'}</button>
    </form>
    {pending.length > 0 && <div><h4>Your waiting surprises</h4><ul className="us-list">{pending.map((item) => <li key={item.id}><span><strong>{labels[item.surprise_type]}</strong><small>{new Date(item.release_at).toLocaleString()}</small></span><button className="us-text-button" type="button" onClick={() => void cancel(item)}>Cancel</button></li>)}</ul></div>}
    <div><h4>Opened surprises</h4>{released.length === 0 ? <p className="us-empty">Nothing has opened yet. The next surprise will appear here.</p>
      : <ul className="scheduled-surprises__list">{released.map((item) => <li key={item.id}><p className="hub-panel__eyebrow">{labels[item.surprise_type]} · {new Date(item.release_at).toLocaleString()}</p>{item.photo_url && <img src={item.photo_url} alt={item.payload.text || 'A surprise from your partner'} />}{item.payload.text && <p>{item.payload.text}</p>}<small>{item.created_by === userId ? 'From you' : 'From your partner'}</small></li>)}</ul>}</div>
    {message && <p className="us-message" role="status">{message}</p>}
  </section>
}

export default ScheduledSurprises
