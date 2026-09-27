import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { getBackgroundMusicVolume, setBackgroundMusicVolume } from '../lib/audio'
import { formatProfileUid } from '../lib/friendSearch'
import { ensureCurrentProfile } from '../lib/profile'
import { supabase } from '../lib/supabase'
import './Settings.css'

type SettingsProps = { onLogout: () => void }

function Settings({ onLogout }: SettingsProps) {
  const [displayName, setDisplayName] = useState('')
  const [uid, setUid] = useState<number | null>(null)
  const [volume, setVolume] = useState(getBackgroundMusicVolume())
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    client.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) {
        setMessage(error?.message ?? 'Unable to load your profile.')
        return
      }
      const name = data.user?.user_metadata?.display_name
      if (typeof name === 'string') setDisplayName(name)
      const result = await ensureCurrentProfile(data.user)
      if (result.error) {
        setMessage(`Unable to load your UID: ${result.error.message}`)
        return
      }
      setUid(result.profile?.display_uid ?? null)
    })
  }, [])

  async function copyUid() {
    if (uid === null) return
    try {
      await navigator.clipboard.writeText(String(uid))
      setMessage('UID copied to your clipboard.')
    } catch {
      setMessage('Copy failed. Press and hold your UID to copy it.')
    }
  }

  async function saveDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = displayName.trim()
    if (!trimmedName) {
      setMessage('Display name cannot be empty.')
      return
    }
    if (!supabase) {
      setMessage('Supabase is not configured. Add the required environment variables.')
      return
    }
    setIsSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { display_name: trimmedName } })
    setIsSaving(false)
    setMessage(error ? error.message : 'Display name saved.')
  }

  async function logout() {
    if (!supabase) {
      onLogout()
      return
    }
    const { error } = await supabase.auth.signOut()
    if (error) {
      setMessage(error.message)
      return
    }
    onLogout()
  }

  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <p className="hub-panel__eyebrow">Make it yours</p>
      <h2 id="settings-title">Settings</h2>
      <p className="settings-panel__intro">Personalize the little details of our hub.</p>
      <div className="settings-card settings-uid-card">
        <div>
          <label htmlFor="your-uid">Your UID</label>
          <p>Share this code so someone can add you as a friend.</p>
        </div>
        <div className="settings-uid-row">
          <output id="your-uid" className="settings-uid">{formatProfileUid(uid)}</output>
          <button type="button" onClick={() => void copyUid()} disabled={uid === null}>Copy</button>
        </div>
      </div>
      <div className="settings-card">
        <label htmlFor="music-volume">Background music</label>
        <div className="settings-volume-row"><input id="music-volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => { const nextVolume = Number(event.target.value); setVolume(nextVolume); setBackgroundMusicVolume(nextVolume) }} /><span>{Math.round(volume * 100)}%</span></div>
      </div>
      <form className="settings-card settings-form" onSubmit={saveDisplayName}>
        <label htmlFor="display-name">Display name</label>
        <input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" maxLength={80} />
        <button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save name'}</button>
      </form>
      {message && <p className="settings-message" role="status">{message}</p>}
      <button className="settings-logout" type="button" onClick={() => void logout()}>Logout</button>
    </section>
  )
}

export default Settings
