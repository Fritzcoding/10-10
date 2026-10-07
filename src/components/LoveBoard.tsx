import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import { BOARD_COLORS, moveKeyboardCursor, normalizePointerPoint, validateBoardStroke, type BoardColor, type BoardPoint } from '../lib/loveBoard'

type Props = { coupleId: string; userId: string }
type Stroke = { id: string; generation: number; created_by: string; points: BoardPoint[]; color: BoardColor; width: number }

export default function LoveBoard({ coupleId, userId }: Props) {
  const [generation, setGeneration] = useState<number | null>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [preview, setPreview] = useState<BoardPoint[]>([])
  const [color, setColor] = useState<BoardColor>(BOARD_COLORS[0])
  const [width, setWidth] = useState(8)
  const [keyboardMode, setKeyboardMode] = useState(false)
  const [cursor, setCursor] = useState<BoardPoint>({ x: 500, y: 500 })
  const [keyboardStroke, setKeyboardStroke] = useState<BoardPoint[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const pointerDrawing = useRef(false)
  const pointerPoints = useRef<BoardPoint[]>([])

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data: board, error: boardError } = await supabase.from('love_boards').select('generation').eq('couple_id', coupleId).maybeSingle()
    if (boardError) { setMessage(formatSupabaseDataError(boardError)); setLoading(false); return }
    if (!board) { setGeneration(null); setStrokes([]); setLoading(false); return }
    const { data, error } = await supabase.from('love_board_strokes').select('id,generation,created_by,points,color,width').eq('couple_id', coupleId).eq('generation', board.generation).order('created_at').order('id')
    if (error) setMessage(formatSupabaseDataError(error))
    else {
      setGeneration(board.generation)
      setStrokes((data ?? []) as Stroke[])
    }
    setLoading(false)
  }, [coupleId])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | undefined
    const load = async () => {
      const { error: ensureError } = await supabase!.rpc('ensure_love_board', { target_couple_id: coupleId })
      if (ensureError) { setMessage(formatSupabaseDataError(ensureError)); setLoading(false); return }
      if (!cancelled) await refresh()
    }
    queueMicrotask(() => void load())
    const client = supabase
    void client.realtime.setAuth().then(() => {
      if (cancelled) return
      channel = client.channel(`love-board:${coupleId}`, { config: { private: true } })
        .on('broadcast', { event: 'board_refresh' }, () => void refresh()).subscribe()
    })
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      if (channel) void client.removeChannel(channel)
    }
  }, [coupleId, refresh])

  const saveStroke = async (points: BoardPoint[]) => {
    if (!supabase || generation === null) return
    try {
      const clean = validateBoardStroke(points, color, width)
      const { error } = await supabase.rpc('append_love_board_stroke', {
        target_couple_id: coupleId, target_generation: generation, target_points: clean.points, target_color: clean.color, target_width: clean.width,
      })
      if (error) throw error
      setMessage('Stroke saved for both of you.')
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : formatSupabaseDataError(error as { message?: string | null }))
      await refresh()
    }
    setPreview([])
  }

  const pointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (keyboardMode || generation === null) return
    const point = normalizePointerPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerDrawing.current = true
    pointerPoints.current = [point]
    setPreview(pointerPoints.current)
  }
  const pointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!pointerDrawing.current) return
    const point = normalizePointerPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
    const previous = pointerPoints.current.at(-1)
    if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 3) return
    pointerPoints.current = [...pointerPoints.current, point]
    setPreview(pointerPoints.current)
  }
  const pointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!pointerDrawing.current) return
    pointerDrawing.current = false
    const point = normalizePointerPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
    const points = [...pointerPoints.current, point]
    pointerPoints.current = []
    void saveStroke(points)
  }

  const keyboardInput = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (!keyboardMode || generation === null) return
    if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      const next = moveKeyboardCursor(cursor, event.key)
      setCursor(next)
      if (keyboardStroke.length) setKeyboardStroke([...keyboardStroke, next])
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (keyboardStroke.length) { void saveStroke(keyboardStroke); setKeyboardStroke([]) }
      else setKeyboardStroke([cursor])
    } else if (event.key === 'Escape') {
      setKeyboardStroke([])
      setPreview([])
    }
  }

  const undo = async () => {
    if (!supabase || generation === null) return
    const { data, error } = await supabase.rpc('undo_love_board_stroke', { target_couple_id: coupleId, target_generation: generation })
    setMessage(error ? formatSupabaseDataError(error) : data ? 'Your last stroke was undone.' : 'You have no strokes to undo.')
    if (!error) await refresh()
  }
  const clear = async () => {
    if (!supabase || generation === null || !window.confirm('Clear the shared Love Board for both of you?')) return
    const { data, error } = await supabase.rpc('clear_love_board', { target_couple_id: coupleId, target_generation: generation })
    setMessage(error ? formatSupabaseDataError(error) : 'The shared board was cleared.')
    if (!error) { setGeneration(data as number); await refresh() }
  }

  const allStrokes = [...strokes, ...(preview.length > 0 ? [{ id: 'preview', generation: generation ?? 1, created_by: userId, points: preview, color, width }] : []), ...(keyboardStroke.length > 0 ? [{ id: 'keyboard-preview', generation: generation ?? 1, created_by: userId, points: keyboardStroke, color, width }] : [])]
  return <section className="us-section love-board" aria-labelledby="love-board-title">
    <div className="us-section__heading"><h3 id="love-board-title">Love Board</h3></div>
    <p className="us-empty">Draw together. Each stroke saves on its own, so neither partner overwrites the other.</p>
    <div className="love-board__controls">
      <div role="group" aria-label="Pen color" className="love-board__colors">{BOARD_COLORS.map((option) => <button key={option} type="button" aria-label={`Use ${option} pen`} aria-pressed={color === option} style={{ '--pen-color': option } as React.CSSProperties} onClick={() => setColor(option)} />)}</div>
      <label htmlFor="board-width">Pen width</label><input id="board-width" type="range" min="2" max="20" value={width} onChange={(event) => setWidth(Number(event.target.value))} />
    </div>
    <svg className="love-board__canvas" viewBox="0 0 1000 1000" role="img" aria-label={keyboardMode ? 'Keyboard drawing board. Press Enter to start and save a stroke, use arrow keys to draw, and Escape to cancel.' : 'Shared drawing board. Use a finger, stylus, or mouse to draw.'} tabIndex={keyboardMode ? 0 : -1} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { pointerDrawing.current = false; pointerPoints.current = []; setPreview([]) }} onKeyDown={keyboardInput}>
      <rect width="1000" height="1000" rx="28" fill="#fff" />
      {allStrokes.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
      {keyboardMode && <circle cx={cursor.x} cy={cursor.y} r="12" fill={color} aria-hidden="true" />}
    </svg>
    <div className="love-board__actions">
      <button type="button" disabled={generation === null || loading} onClick={() => { setKeyboardMode((enabled) => !enabled); setKeyboardStroke([]); setPreview([]) }} aria-pressed={keyboardMode}>{keyboardMode ? 'Keyboard drawing on' : 'Draw with keyboard'}</button>
      {keyboardMode && <span className="us-empty">Focus the board. Enter starts/saves, arrows move/draw, Escape cancels.</span>}
      <button type="button" onClick={() => void undo()} disabled={generation === null}>Undo my last stroke</button>
      <button type="button" onClick={() => void clear()} disabled={generation === null}>Clear shared board</button>
    </div>
    {loading && <p role="status">Loading your shared board…</p>}
    {!loading && strokes.length === 0 && <p className="us-empty">Your board is ready for its first drawing.</p>}
    {message && <p className="us-message" role="status">{message}</p>}
  </section>
}
