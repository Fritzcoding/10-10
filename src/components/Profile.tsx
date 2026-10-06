import { useEffect, useState } from 'react'
import { ensureCurrentProfile } from '../lib/profile'
import { pairedLabel } from '../lib/profileSocial'
import { isRemoteAvatarUrl, isValidAvatarFile, profileAvatarPath } from '../lib/profileAvatar'
import { supabase } from '../lib/supabase'
import './Profile.css'

type ProfileRow = { display_name: string | null; display_uid: number | null; avatar_url?: string | null; partner_id?: string | null; partner_name?: string | null }

function Profile() {
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarSource, setAvatarSource] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [message, setMessage] = useState('')
  const [messageRole, setMessageRole] = useState<'status' | 'alert'>('status')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    void client.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) { if (active) { setMessageRole('alert'); setMessage(error?.message ?? 'Sign in to view your profile.') }; return }
      await ensureCurrentProfile(data.user)
      const result = await client.from('profiles').select('display_name, display_uid, avatar_url, partner_id, partner_name').eq('id', data.user.id).maybeSingle()
      if (result.error) { if (active) { setMessageRole('alert'); setMessage(result.error.message) }; return }
      const next = result.data as ProfileRow
      if (!active) return
      setProfile(next); setDisplayName(next.display_name ?? '')
      const savedAvatar = next.avatar_url ?? ''
      setAvatarUrl(savedAvatar)
      if (isRemoteAvatarUrl(savedAvatar)) setAvatarSource(savedAvatar)
      else if (savedAvatar) {
        const { data: signed, error: signedError } = await client.storage.from('profile-avatars').createSignedUrl(savedAvatar, 3600)
        if (!active) return
        if (signedError) { setMessageRole('alert'); setMessage(signedError.message) }
        else setAvatarSource(signed.signedUrl)
      }
    })
    return () => { active = false }
  }, [])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  function chooseAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!isValidAvatarFile(file)) {
      setAvatarFile(null); setPreviewUrl(''); setMessageRole('alert')
      setMessage('Choose a JPEG, PNG, or WebP image no larger than 5 MiB.')
      event.target.value = ''
      return
    }
    setMessage(''); setAvatarFile(file); setPreviewUrl(URL.createObjectURL(file))
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setMessage('Supabase is not configured.'); return }
    setSaving(true)
    setMessage('')
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) throw error ?? new Error('Sign in before saving your profile.')
      let nextAvatar = avatarUrl
      if (avatarFile) {
        nextAvatar = profileAvatarPath(data.user.id)
        const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(nextAvatar, avatarFile, {
          upsert: true, contentType: avatarFile.type, cacheControl: '3600',
        })
        if (uploadError) throw uploadError
      }
      const nextName = displayName.trim() || null
      const result = await supabase.from('profiles').update({ display_name: nextName, avatar_url: nextAvatar || null }).eq('id', data.user.id)
      if (result.error) throw result.error
      setProfile((current) => current ? { ...current, display_name: nextName, avatar_url: nextAvatar || null } : current)
      setDisplayName(nextName ?? '')
      setAvatarUrl(nextAvatar)
      if (isRemoteAvatarUrl(nextAvatar)) setAvatarSource(nextAvatar)
      else if (nextAvatar) {
        const { data: signed } = await supabase.storage.from('profile-avatars').createSignedUrl(nextAvatar, 3600)
        if (signed?.signedUrl) setAvatarSource(signed.signedUrl)
      } else setAvatarSource('')
      setAvatarFile(null); setPreviewUrl(''); setMessageRole('status'); setMessage('Profile saved.')
    } catch (error) {
      setMessageRole('alert'); setMessage(error instanceof Error ? error.message : 'Your profile could not be saved.')
    } finally { setSaving(false) }
  }

  const partner = pairedLabel(profile?.partner_id, profile?.partner_name)
  return <section className="profile-panel" aria-labelledby="profile-title">
    <p className="hub-panel__eyebrow">A little more you</p>
    <h2 id="profile-title">Profile</h2>
    <div className="profile-hero">
      {previewUrl || avatarSource ? <img src={previewUrl || avatarSource} alt="Your avatar" /> : <div className="profile-avatar-placeholder" aria-hidden="true">♡</div>}
      <div><strong>{profile?.display_name || 'Your profile'}</strong><span>{profile?.display_uid ? `UID: #${profile.display_uid}` : 'UID: #--'}</span></div>
    </div>
    <div className="profile-card"><span className="profile-card__label">Pairing</span><strong>{partner}</strong>{profile?.partner_id && <p>Your partner connection is active.</p>}</div>
    <form className="profile-card profile-form" onSubmit={(event) => void saveProfile(event)}>
      <label htmlFor="profile-name">Display name</label><input id="profile-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="Your name" />
      <label htmlFor="profile-avatar-file">Avatar image</label><input id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} disabled={saving} />
      <small>JPEG, PNG, or WebP · up to 5 MiB</small>
      <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
    </form>
    <div className="profile-card"><span className="profile-card__label">Badges</span><div className="profile-badges"><span>New here</span>{profile?.partner_id && <span>Paired</span>}</div></div>
    <div className="profile-card profile-card--muted"><span className="profile-card__label">More features coming soon</span><p>Memories, shared milestones, and more ways to make this space yours.</p></div>
    {message && <p className="profile-message" role={messageRole}>{message}</p>}
  </section>
}

export default Profile
