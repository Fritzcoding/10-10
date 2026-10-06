import { useCallback, useEffect, useRef, useState } from 'react'
import { drawingObjectPath, DRAWING_DURATION_PRESETS, validateDrawingDuration, validateDrawingImage } from '../../lib/drawingGame'
import { expireDrawingRound, setDrawingReference, startDrawingRound, submitDrawing, type DrawingRound, type GameSession } from '../../lib/gameSessions'
import { supabase } from '../../lib/supabase'
import { formatSupabaseDataError } from '../../lib/supabaseErrors'
import { drawingCategories, drawingSubjectsForCategory, validateDrawingPrompt } from '../../lib/drawingPrompts'
import './DrawingGame.css'

type Submission = { round_id: string; user_id: string; image_path: string; submitted_at: string }

export default function DrawingGame({ session, userId, onExit }: { session: GameSession; userId: string; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const keyboardCursor = useRef({ x: 480, y: 320 })
  const expired = useRef('')
  const [round, setRound] = useState<DrawingRound | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [duration, setDuration] = useState<number>(60)
  const [promptMode, setPromptMode] = useState<'preset' | 'custom'>('preset')
  const [category, setCategory] = useState(() => drawingCategories()[0] ?? '')
  const [subject, setSubject] = useState(() => drawingSubjectsForCategory(drawingCategories()[0] ?? '')[0] ?? '')
  const [reference, setReference] = useState<File | null>(null)
  const [referenceUrl, setReferenceUrl] = useState('')
  const [drawings, setDrawings] = useState<Record<string, string>>({})
  const [drawing, setDrawing] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const requester = session.player_x_id === userId

  const refresh = useCallback(async () => {
    if (!supabase) return
    const client = supabase
    const { data: roundData, error } = await client.from('drawing_rounds').select('*').eq('session_id', session.id).maybeSingle()
    if (error) { setMessage(formatSupabaseDataError(error)); return }
    if (!roundData) return
    const nextRound = roundData as DrawingRound
    setRound(nextRound)
    const { data, error: submissionsError } = await client.from('drawing_submissions').select('*').eq('round_id', nextRound.id)
    if (submissionsError) { setMessage(formatSupabaseDataError(submissionsError)); return }
    const rows = (data ?? []) as Submission[]
    setSubmissions(rows)
    if (nextRound.reference_path) {
      const { data: file } = await client.storage.from('couple-drawings').download(nextRound.reference_path)
      if (file) setReferenceUrl(URL.createObjectURL(file))
    }
    if (nextRound.status === 'completed' || Date.parse(nextRound.deadline_at ?? '') <= Date.now()) {
      const loaded = await Promise.all(rows.map(async (row) => {
        const { data: file } = await client.storage.from('couple-drawings').download(row.image_path)
        return file ? [row.user_id, URL.createObjectURL(file)] as const : null
      }))
      setDrawings(Object.fromEntries(loaded.filter((item): item is readonly [string, string] => item !== null)))
    }
  }, [session.id])

  useEffect(() => { queueMicrotask(() => void refresh())
    if (!supabase) return
    const client = supabase
    const channel = client.channel(`drawing-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drawing_rounds', filter: `session_id=eq.${session.id}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drawing_submissions' }, () => void refresh())
      .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh() })
    const focus = () => { void refresh() }
    window.addEventListener('focus', focus)
    return () => { window.removeEventListener('focus', focus); void client.removeChannel(channel) }
  }, [refresh, session.id])

  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id) }, [])
  useEffect(() => {
    if (!round || round.status !== 'active' || !round.deadline_at || Date.parse(round.deadline_at) > now || expired.current === round.id) return
    expired.current = round.id
    void expireDrawingRound(round.id).then(() => refresh()).catch((error) => setMessage(formatSupabaseDataError(error as { message?: string | null })))
  }, [now, refresh, round])
  useEffect(() => () => { if (referenceUrl) URL.revokeObjectURL(referenceUrl); Object.values(drawings).forEach(URL.revokeObjectURL) }, [drawings, referenceUrl])

  const start = async () => {
    if (!supabase || !round) return
    setBusy(true); setMessage('')
    try {
      const validDuration = validateDrawingDuration(duration)
      const prompt = validateDrawingPrompt(subject, category)
      await startDrawingRound(session.id, validDuration, prompt.subject, prompt.category, null)
      await refresh()
    } catch (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })) }
    finally { setBusy(false) }
  }

  const uploadReference = async (file?: File) => {
    if (!supabase || !file) return
    setBusy(true); setMessage('')
    try {
      if (!validateDrawingImage(file.type, file.size)) throw new Error('Choose a JPEG, PNG, or WebP image under 5 MiB.')
      const path = drawingObjectPath(session.id, 'reference', file.type)
      const { error } = await supabase.storage.from('couple-drawings').upload(path, file, { contentType: file.type, upsert: true })
      if (error) throw error
      await setDrawingReference(session.id, path)
      setReference(file)
      await refresh()
    } catch (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })) }
    finally { setBusy(false) }
  }

  const pointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    const context = canvas.getContext('2d')
    if (!context) return
    const x = (event.clientX - bounds.left) * canvas.width / bounds.width
    const y = (event.clientY - bounds.top) * canvas.height / bounds.height
    if (event.type === 'pointerdown') { canvas.setPointerCapture(event.pointerId); context.beginPath(); context.moveTo(x, y); setDrawing(true) }
    else if (event.type === 'pointermove' && drawing) { context.lineWidth = 8; context.lineCap = 'round'; context.strokeStyle = '#3457a4'; context.lineTo(x, y); context.stroke() }
    else if (event.type === 'pointerup' || event.type === 'pointercancel') setDrawing(false)
  }

  const drawWithKeyboard = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const movements: Record<string, [number, number]> = { ArrowUp: [0, -12], ArrowDown: [0, 12], ArrowLeft: [-12, 0], ArrowRight: [12, 0] }
    const movement = movements[event.key]
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!movement || !canvas || !context) return
    event.preventDefault()
    const cursor = keyboardCursor.current
    const next = { x: Math.max(0, Math.min(canvas.width, cursor.x + movement[0])), y: Math.max(0, Math.min(canvas.height, cursor.y + movement[1])) }
    context.lineWidth = 8; context.lineCap = 'round'; context.strokeStyle = '#3457a4'
    context.beginPath(); context.moveTo(cursor.x, cursor.y); context.lineTo(next.x, next.y); context.stroke()
    keyboardCursor.current = next
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    keyboardCursor.current = { x: 480, y: 320 }
  }

  const submitCanvas = async () => {
    const canvas = canvasRef.current
    if (!supabase || !canvas || !round) return
    setBusy(true); setMessage('')
    try {
      const file = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not save this drawing.')), 'image/png'))
      if (!validateDrawingImage(file.type, file.size)) throw new Error('This drawing is larger than the 5 MiB limit.')
      const path = drawingObjectPath(session.id, 'drawing', 'image/png', userId)
      const { error } = await supabase.storage.from('couple-drawings').upload(path, file, { contentType: 'image/png', upsert: false })
      if (error) throw error
      await submitDrawing(round.id, path)
      await refresh()
    } catch (error) { setMessage(formatSupabaseDataError(error as { message?: string | null })) }
    finally { setBusy(false) }
  }

  const remaining = round?.deadline_at ? Math.max(0, Math.ceil((Date.parse(round.deadline_at) - now) / 1000)) : null
  const ownSubmission = submissions.some((item) => item.user_id === userId)
  const revealed = round?.status === 'completed' || (remaining === 0 && remaining !== null)

  return <section className="drawing-game">
    <p className="drawing-game__eyebrow">A little art, made together</p><h2>Draw Together</h2>
    {!round && <p role="status">Loading your round…</p>}
    {round?.status === 'waiting' && requester && <div className="drawing-game__setup">
      <label>Prompt type<select value={promptMode} onChange={(event) => setPromptMode(event.target.value as 'preset' | 'custom')}><option value="preset">Choose a topic and prompt</option><option value="custom">Write my own</option></select></label>
      {promptMode === 'preset' ? <>
        <label>Topic<select value={category} onChange={(event) => { const nextCategory = event.target.value; setCategory(nextCategory); setSubject(drawingSubjectsForCategory(nextCategory)[0] ?? '') }}>{drawingCategories().map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Thing to draw<select value={subject} onChange={(event) => setSubject(event.target.value)}>{drawingSubjectsForCategory(category).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </> : <>
        <label>Thing to draw<input maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. a sleepy dragon" /></label>
        <label>Topic or classification<input maxLength={60} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. fantasy creature" /></label>
      </>}
      <label>Drawing time<select value={DRAWING_DURATION_PRESETS.includes(duration as typeof DRAWING_DURATION_PRESETS[number]) ? duration : 'custom'} onChange={(event) => setDuration(event.target.value === 'custom' ? 0 : Number(event.target.value))}>{DRAWING_DURATION_PRESETS.map((seconds) => <option key={seconds} value={seconds}>{seconds < 60 ? `${seconds} seconds` : `${seconds / 60} minute${seconds > 60 ? 's' : ''}`}</option>)}<option value="custom">Custom…</option></select></label>
      {!DRAWING_DURATION_PRESETS.includes(duration as typeof DRAWING_DURATION_PRESETS[number]) && <label>Custom seconds<input type="number" min={15} max={600} value={duration || ''} onChange={(event) => setDuration(Number(event.target.value))} /></label>}
      <label>Optional reference image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void uploadReference(event.target.files?.[0])} /></label>
      {reference && <p>{reference.name} · {(reference.size / 1024 / 1024).toFixed(1)} MiB · Ready for both of you</p>}
      {referenceUrl && <figure><figcaption>Shared reference preview</figcaption><img className="drawing-game__reference" src={referenceUrl} alt="Shared drawing reference" /></figure>}
      <button type="button" disabled={busy} onClick={() => void start()}>{busy ? 'Starting…' : 'Start drawing'}</button>
    </div>}
    {round?.status === 'waiting' && !requester && <>{referenceUrl && <figure><figcaption>Shared reference preview</figcaption><img className="drawing-game__reference" src={referenceUrl} alt="Shared drawing reference" /></figure>}<p role="status">Waiting for your partner to set up the round.</p></>}
    {round?.status === 'active' && <>
      {round.subject && round.category && <p className="drawing-game__prompt"><span>{round.category}</span><strong>Draw: {round.subject}</strong></p>}
      {referenceUrl && <figure><figcaption>Reference image</figcaption><img className="drawing-game__reference" src={referenceUrl} alt="Shared drawing reference" /></figure>}
      <p className="drawing-game__timer" role="timer">{remaining}s remaining</p>
      {!ownSubmission ? <><canvas ref={canvasRef} width={960} height={640} tabIndex={0} aria-label="Drawing canvas. Draw with touch or pointer, or use the arrow keys." onKeyDown={drawWithKeyboard} onPointerDown={pointer} onPointerMove={pointer} onPointerUp={pointer} onPointerCancel={pointer} /><button type="button" onClick={clearCanvas}>Clear drawing</button><button type="button" disabled={busy} onClick={() => void submitCanvas()}>{busy ? 'Submitting…' : 'Submit drawing'}</button></> : <p role="status">Your drawing is private. Waiting for your partner…</p>}
    </>}
    {round?.status === 'completed' && revealed && <div className="drawing-game__reveal">{round.subject && round.category && <p className="drawing-game__prompt"><span>{round.category}</span><strong>Draw: {round.subject}</strong></p>}<h3>Your drawings</h3>{referenceUrl && <figure><figcaption>Reference image</figcaption><img src={referenceUrl} alt="Shared drawing reference" /></figure>}{submissions.map((item) => <figure key={item.user_id}><figcaption>{item.user_id === userId ? 'Your drawing' : 'Your partner’s drawing'}</figcaption>{drawings[item.user_id] ? <img src={drawings[item.user_id]} alt={item.user_id === userId ? 'Your submitted drawing' : 'Your partner’s submitted drawing'} /> : <p>Drawing is unavailable.</p>}</figure>)}<button type="button" onClick={onExit}>Back to games</button></div>}
    {message && <p role="alert">{message}</p>}
  </section>
}
