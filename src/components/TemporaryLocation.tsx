import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import { isLocationFresh, locationErrorMessage, LOCATION_DURATIONS, validateLocation, validateShareDuration } from '../lib/temporaryLocation'

type LocationShare = { couple_id: string; shared_by: string; latitude: number; longitude: number; accuracy_meters: number; started_at: string; updated_at: string; expires_at: string }
type Props = { coupleId: string; userId: string }

function timeLeft(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function TemporaryLocation({ coupleId, userId }: Props) {
  const [shares, setShares] = useState<LocationShare[]>([])
  const [duration, setDuration] = useState<number>(30)
  const [now, setNow] = useState(0)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const watchId = useRef<number | null>(null)
  const tracking = useRef(false)
  const startPending = useRef(false)
  const hasStarted = useRef(false)
  const lastUpdateAttempt = useRef(0)
  const expiresAt = useRef<string | null>(null)
  const stopWatching = useCallback(() => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }, [])
  const savedOwnShare = shares.find((share) => share.shared_by === userId)
  const ownShare = savedOwnShare && Date.parse(savedOwnShare.expires_at) > now ? savedOwnShare : undefined
  const activeShares = shares.filter((share) => Date.parse(share.expires_at) > now)

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data, error } = await supabase.from('temporary_location_shares').select('couple_id,shared_by,latitude,longitude,accuracy_meters,started_at,updated_at,expires_at').eq('couple_id', coupleId)
    if (error) setMessage(formatSupabaseDataError(error))
    else {
      const nextShares = (data ?? []) as LocationShare[]
      const own = nextShares.find((share) => share.shared_by === userId)
      expiresAt.current = own?.expires_at ?? null
      if (!own || Date.parse(own.expires_at) <= Date.now()) { tracking.current = false; hasStarted.current = false; stopWatching() }
      setShares(nextShares)
    }
    setLoading(false)
  }, [coupleId, stopWatching, userId])

  const stopShare = useCallback(async (successMessage = 'Location sharing stopped.') => {
    tracking.current = false
    hasStarted.current = false
    stopWatching()
    if (!supabase) return
    const { error } = await supabase.rpc('stop_location_share', { target_couple_id: coupleId })
    setMessage(error ? formatSupabaseDataError(error) : successMessage)
    if (!error) await refresh()
  }, [coupleId, refresh, stopWatching])

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) { setMessage(locationErrorMessage(0)); tracking.current = false; return }
    if (document.visibilityState !== 'visible' || !navigator.onLine || watchId.current !== null) return
    tracking.current = true
    watchId.current = navigator.geolocation.watchPosition(async (position) => {
      let clean: ReturnType<typeof validateLocation>
      try { clean = validateLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy) }
      catch (error) { setMessage((error as Error).message); return }
      if (!supabase || !navigator.onLine || startPending.current) return
      const timestamp = Date.now()
      if (hasStarted.current && timestamp - lastUpdateAttempt.current < 15_000) return
      const starting = !hasStarted.current
      startPending.current = true
      lastUpdateAttempt.current = timestamp
      const result = starting
        ? await supabase?.rpc('start_location_share', { target_couple_id: coupleId, target_latitude: clean.latitude, target_longitude: clean.longitude, target_accuracy_meters: clean.accuracy, target_duration_minutes: validateShareDuration(duration) })
        : await supabase?.rpc('update_location_share', { target_couple_id: coupleId, target_latitude: clean.latitude, target_longitude: clean.longitude, target_accuracy_meters: clean.accuracy })
      startPending.current = false
      if (result?.error) {
        setMessage(formatSupabaseDataError(result.error))
        if (starting) { tracking.current = false; stopWatching() }
        return
      }
      hasStarted.current = true
      setMessage(starting ? `Sharing started for ${duration} minutes. Updates pause when this page is hidden.` : 'Location updated.')
      await refresh()
    }, (error) => {
      setMessage(locationErrorMessage(error.code))
      stopWatching()
      if (error.code === 1) void stopShare('Location permission was denied. Your active share was stopped.')
    }, { enableHighAccuracy: false, maximumAge: 15_000, timeout: 20_000 })
  }, [coupleId, duration, refresh, stopShare, stopWatching])

  useEffect(() => {
    queueMicrotask(() => void refresh())
    if (!supabase) return
    const client = supabase
    let channel: ReturnType<typeof client.channel> | undefined
    let cancelled = false
    void client.realtime.setAuth().then(() => {
      if (cancelled) return
      channel = client.channel(`temporary-location:${coupleId}`, { config: { private: true } })
        .on('broadcast', { event: 'location_refresh' }, () => void refresh()).subscribe()
    })
    const tick = () => {
      const timestamp = Date.now()
      setNow(timestamp)
      if (expiresAt.current && Date.parse(expiresAt.current) <= timestamp) { tracking.current = false; hasStarted.current = false; stopWatching() }
    }
    const poll = window.setInterval(() => { tick(); void refresh() }, 15_000)
    const clock = window.setInterval(tick, 1_000)
    const resume = () => {
      if (document.visibilityState === 'visible') { setNow(Date.now()); void refresh(); if (tracking.current) startWatching() }
      else stopWatching()
    }
    const offline = () => { stopWatching(); setMessage('You are offline. No locations are queued; your partner may see a stale position.') }
    const online = () => { if (tracking.current) startWatching(); void refresh() }
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      window.clearInterval(clock)
      window.removeEventListener('focus', resume)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', online)
      stopWatching()
      tracking.current = false
      if (channel) void client.removeChannel(channel)
    }
  }, [coupleId, refresh, startWatching, stopWatching])

  useEffect(() => { hasStarted.current = Boolean(ownShare) }, [ownShare])

  return <section className="us-section temporary-location" aria-labelledby="temporary-location-title">
    <div className="us-section__heading"><h3 id="temporary-location-title">Temporary location</h3></div>
    <p className="us-empty">Share only when you choose. Your partner can see your current coordinates until you stop or the timer ends. Updates run only while this panel is open and visible. Hiding or leaving it pauses updates; the timed share still expires automatically. No location history is kept.</p>
    {loading ? <p role="status">Loading active shares…</p> : activeShares.length === 0 ? <p className="us-empty">Neither of you is sharing a location right now.</p> : <ul className="us-list milestone-list">{activeShares.map((share) => {
      const fresh = isLocationFresh(share.updated_at, share.expires_at, new Date(now))
      return <li key={`${share.couple_id}:${share.shared_by}`}>
        <span><strong>{share.shared_by === userId ? 'You are sharing' : 'Your partner is sharing'}{!fresh ? ' · Location may be stale' : ''}</strong><small>Updated {new Date(share.updated_at).toLocaleTimeString()} · Expires in {timeLeft(share.expires_at, now)}</small><small>Coordinates: {share.latitude.toFixed(4)}, {share.longitude.toFixed(4)} · Accuracy about {Math.round(share.accuracy_meters)} m</small></span>
        {share.shared_by === userId && <div className="milestone-list__actions"><button className="us-text-button" type="button" onClick={startWatching}>Resume updates</button><button className="us-text-button" type="button" onClick={() => void stopShare()}>Stop sharing</button></div>}
      </li>
    })}</ul>}
    {!ownShare && <form className="us-form" onSubmit={(event) => { event.preventDefault(); setMessage('Waiting for location permission…'); startWatching() }}>
      <label htmlFor="location-duration">Share duration</label>
      <select id="location-duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{LOCATION_DURATIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select>
      <button type="submit">Start sharing my location</button>
    </form>}
    {message && <p className="us-message" role="status">{message}</p>}
  </section>
}
