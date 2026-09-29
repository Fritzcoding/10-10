import { useEffect, useState } from 'react'
import { ensureCurrentProfile } from '../lib/profile'
import { pairedLabel } from '../lib/profileSocial'
import { supabase } from '../lib/supabase'
import './Profile.css'

type ProfileRow = { display_name: string | null; display_uid: number | null; avatar_url?: string | null; partner_id?: string | null; partner_name?: string | null }

function Profile() {
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    void client.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) { setMessage(error?.message ?? 'Sign in to view your profile.'); return }
      await ensureCurrentProfile(data.user)
      const result = await client.from('profiles').select('display_name, display_uid, avatar_url, partner_id, partner_name').eq('id', data.user.id).maybeSingle()
      if (result.error) {
        const fallback = await client.from('profiles').select('display_name, display_uid, partner_id, partner_name').eq('id', data.user.id).maybeSingle()
        if (fallback.error) { setMessage(fallback.error.message); return }
        const next = fallback.data as ProfileRow
        setProfile(next); setDisplayName(next.display_name ?? ''); return
      }
      const next = result.data as ProfileRow
      setProfile(next); setDisplayName(next.display_name ?? ''); setAvatarUrl(next.avatar_url ?? '')
    })
  }, [])

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setMessage('Supabase is not configured.'); return }
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    setSaving(true)
    const result = await supabase.from('profiles').update({ display_name: displayName.trim() || null, avatar_url: avatarUrl.trim() || null }).eq('id', data.user.id)
    setSaving(false)
    setMessage(result.error ? result.error.message : 'Profile saved.')
    if (!result.error) setProfile((current) => current ? { ...current, display_name: displayName.trim() || null, avatar_url: avatarUrl.trim() || null } : current)
  }

  const partner = pairedLabel(profile?.partner_id, profile?.partner_name)
  return <section className="profile-panel" aria-labelledby="profile-title">
    <p className="hub-panel__eyebrow">A little more you</p>
    <h2 id="profile-title">Profile</h2>
    <div className="profile-hero">
      {avatarUrl ? <img src={avatarUrl} alt="Your avatar" /> : <div className="profile-avatar-placeholder" aria-hidden="true">♡</div>}
      <div><strong>{profile?.display_name || 'Your profile'}</strong><span>{profile?.display_uid ? `UID: #${profile.display_uid}` : 'UID: #--'}</span></div>
    </div>
    <div className="profile-card"><span className="profile-card__label">Pairing</span><strong>{partner}</strong>{profile?.partner_id && <p>Your partner connection is active.</p>}</div>
    <form className="profile-card profile-form" onSubmit={(event) => void saveProfile(event)}>
      <label htmlFor="profile-name">Display name</label><input id="profile-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="Your name" />
      <label htmlFor="profile-avatar">Avatar image URL</label><input id="profile-avatar" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://…" type="url" />
      <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
    </form>
    <div className="profile-card"><span className="profile-card__label">Badges</span><div className="profile-badges"><span>New here</span>{profile?.partner_id && <span>Paired</span>}</div></div>
    <div className="profile-card profile-card--muted"><span className="profile-card__label">More features coming soon</span><p>Memories, shared milestones, and more ways to make this space yours.</p></div>
    {message && <p className="profile-message" role="status">{message}</p>}
  </section>
}

export default Profile
