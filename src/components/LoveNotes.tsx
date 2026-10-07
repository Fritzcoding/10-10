import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import { validateLoveNote, validateVoiceMemo } from '../lib/loveNotes'

type NoteRow = { id: string; content: string; audio_path: string | null; audio_duration_ms: number | null; created_by: string; created_at: string }
type Note = NoteRow & { audioUrl?: string }
type Props = { coupleId: string; userId: string }
const MAX_RECORDING_MS = 60_000

function LoveNotes({ coupleId, userId }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recording, setRecording] = useState(false)
  const [savingAudioId, setSavingAudioId] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordStartedRef = useRef(0)
  const stopTimerRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data, error } = await supabase.from('love_notes').select('id,content,audio_path,audio_duration_ms,created_by,created_at').eq('couple_id', coupleId).order('created_at', { ascending: false })
    if (error) { setMessage(formatSupabaseDataError(error)); setLoading(false); return }
    const rows = (data ?? []) as NoteRow[]
    const next = await Promise.all(rows.map(async (row) => {
      if (!row.audio_path) return row
      const { data: audio, error: audioError } = await supabase!.storage.from('couple-voice-memos').download(row.audio_path)
      if (audioError) throw audioError
      return { ...row, audioUrl: URL.createObjectURL(audio) }
    }))
    setNotes(next)
    setLoading(false)
  }, [coupleId])

  useEffect(() => () => { notes.forEach(({ audioUrl }) => { if (audioUrl) URL.revokeObjectURL(audioUrl) }) }, [notes])
  useEffect(() => {
    queueMicrotask(() => { void refresh().catch((error) => { setMessage(formatSupabaseDataError(error)); setLoading(false) }) })
    if (!supabase) return
    const client = supabase
    const channel = client.channel(`love-notes:${coupleId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'love_notes', filter: `couple_id=eq.${coupleId}` }, () => {
      void refresh().catch((error) => setMessage(formatSupabaseDataError(error)))
    }).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [coupleId, refresh])

  useEffect(() => () => {
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current)
    if (tickRef.current !== null) window.clearInterval(tickRef.current)
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const saveNote = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    let content: string
    try { content = validateLoveNote(draft) } catch (error) { setMessage((error as Error).message); return }
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('love_notes').insert({ couple_id: coupleId, content })
    if (error) setMessage(formatSupabaseDataError(error))
    else { setDraft(''); setMessage('Love note saved.'); await refresh() }
    setSaving(false)
  }

  const updateNote = async (note: Note) => {
    if (!supabase) return
    let content: string
    try { content = validateLoveNote(editing[note.id] ?? note.content) } catch (error) { setMessage((error as Error).message); return }
    const { error } = await supabase.from('love_notes').update({ content }).eq('id', note.id)
    if (error) setMessage(formatSupabaseDataError(error))
    else { setEditing((current) => { const next = { ...current }; delete next[note.id]; return next }); await refresh(); setMessage('Love note updated.') }
  }

  const removeNote = async (note: Note) => {
    if (!supabase || !window.confirm('Remove this note and voice memo for both of you?')) return
    const { error } = await supabase.from('love_notes').delete().eq('id', note.id)
    if (error) { setMessage(formatSupabaseDataError(error)); return }
    const { error: audioError } = note.audio_path ? await supabase.storage.from('couple-voice-memos').remove([note.audio_path]) : { error: null }
    await refresh()
    setMessage(audioError ? 'Note removed, but its audio file could not be deleted.' : 'Love note removed.')
  }

  const attachRecording = async (note: Note, file: File, durationMs: number) => {
    if (!supabase) return
    try { validateVoiceMemo(file, durationMs) } catch (error) { setMessage((error as Error).message); return }
    setSavingAudioId(note.id)
    setMessage('')
    const extension = file.type === 'audio/mp4' ? 'mp4' : file.type === 'audio/ogg' ? 'ogg' : 'webm'
    const path = `${coupleId}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('couple-voice-memos').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) { setMessage(formatSupabaseDataError(uploadError)); setSavingAudioId(''); return }
    const { error: updateError } = await supabase.from('love_notes').update({ audio_path: path, audio_duration_ms: Math.round(durationMs) }).eq('id', note.id)
    if (updateError) {
      await supabase.storage.from('couple-voice-memos').remove([path])
      setMessage(formatSupabaseDataError(updateError))
    } else {
      if (note.audio_path) await supabase.storage.from('couple-voice-memos').remove([note.audio_path])
      await refresh()
      setMessage('Voice memo saved with your note.')
    }
    setSavingAudioId('')
  }

  const startRecording = async (note: Note) => {
    setMessage('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setMessage('Voice recording is not available in this browser. Your note is still saved.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type))
      if (!mimeType) throw new Error('This browser cannot create a supported audio recording. Your note is still saved.')
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder
      recordStartedRef.current = Date.now()
      setElapsed(0)
      setRecording(true)
      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return
        const duration = Date.now() - recordStartedRef.current
        const file = new File([event.data], `voice-memo.${mimeType.split('/')[1]}`, { type: mimeType })
        void attachRecording(note, file, duration)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        if (streamRef.current === stream) streamRef.current = null
        setRecording(false)
        if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current)
        if (tickRef.current !== null) window.clearInterval(tickRef.current)
        setElapsed(0)
      }
      recorder.start()
      tickRef.current = window.setInterval(() => setElapsed(Math.min(MAX_RECORDING_MS, Date.now() - recordStartedRef.current)), 250)
      stopTimerRef.current = window.setTimeout(() => recorder.state === 'recording' && recorder.stop(), MAX_RECORDING_MS)
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setRecording(false)
      setMessage(`${(error as Error).message || 'Microphone access failed.'} Your note is still saved.`)
    }
  }

  const stopRecording = () => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() }

  return <section className="us-section love-notes" aria-labelledby="love-notes-title">
    <div className="us-section__heading"><h3 id="love-notes-title">Love notes</h3><span>{notes.length}</span></div>
    <form className="us-form" onSubmit={(event) => void saveNote(event)}>
      <label htmlFor="love-note-draft">Write something for your partner</label>
      <textarea id="love-note-draft" maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button type="submit" disabled={saving}>{saving ? 'Saving note…' : 'Save love note'}</button>
    </form>
    {loading ? <p role="status">Loading love notes…</p> : notes.length === 0 ? <p className="us-empty">A few words can become a keepsake.</p> : <ul className="love-notes__list">{notes.map((note) => <li key={note.id}>
      <p className="love-notes__author">{note.created_by === userId ? 'You' : 'Your partner'} · {new Date(note.created_at).toLocaleDateString()}</p>
      <label className="sr-only" htmlFor={`love-note-${note.id}`}>Edit love note</label>
      <textarea id={`love-note-${note.id}`} maxLength={2000} value={editing[note.id] ?? note.content} onChange={(event) => setEditing((current) => ({ ...current, [note.id]: event.target.value }))} />
      <div className="milestone-list__actions">
        {(editing[note.id] ?? note.content) !== note.content && <button className="us-text-button" type="button" onClick={() => void updateNote(note)}>Save edit</button>}
        {!note.audio_path && <button className="us-text-button" type="button" disabled={recording || savingAudioId !== ''} onClick={() => void startRecording(note)}>{recording ? 'Recording…' : savingAudioId === note.id ? 'Saving voice…' : 'Record voice memo'}</button>}
        {note.audio_path && note.audioUrl && <audio controls preload="none" src={note.audioUrl} aria-label={`Voice memo from ${note.created_by === userId ? 'you' : 'your partner'}`} />}
        {recording && <><span role="timer">{Math.ceil(elapsed / 1000)} / 60 sec</span><button className="us-text-button" type="button" onClick={stopRecording}>Stop recording</button></>}
        {note.audio_path && <button className="us-text-button" type="button" disabled={savingAudioId !== ''} onClick={() => void (async () => {
          if (!supabase || !window.confirm('Remove this voice memo?')) return
          const { error: updateError } = await supabase.from('love_notes').update({ audio_path: null, audio_duration_ms: null }).eq('id', note.id)
          if (updateError) { setMessage(formatSupabaseDataError(updateError)); return }
          const { error } = await supabase.storage.from('couple-voice-memos').remove([note.audio_path!])
          if (error) setMessage('Voice memo removed from the note, but its audio file could not be deleted.')
          else setMessage('Voice memo removed.')
          await refresh()
        })()}>Remove voice memo</button>}
        <button className="us-text-button" type="button" onClick={() => void removeNote(note)}>Remove note</button>
      </div>
    </li>)}</ul>}
    {message && <p className="us-message" role="status">{message}</p>}
  </section>
}

export default LoveNotes
