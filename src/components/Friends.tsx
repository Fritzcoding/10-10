import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { normalizeFriendSearch } from '../lib/friendSearch'
import { supabase } from '../lib/supabase'
import './Friends.css'

type Profile = { id: string; uid: string; email: string; display_name: string | null; partner_id?: string | null; partner_name?: string | null }
type Request = { id: string; requester_id: string; recipient_id: string; status: string; request_type?: string }

function Friends() {
  const [userId, setUserId] = useState<string>()
  const [friends, setFriends] = useState<Profile[]>([])
  const [incomingRequests, setIncomingRequests] = useState<Request[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [searchResult, setSearchResult] = useState<Profile | null>(null)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  async function loadFriends(currentUserId: string) {
    if (!supabase) return
    const { data: requests, error } = await supabase
      .from('friend_requests')
      .select('id, requester_id, recipient_id, status, request_type')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
    if (error) throw error

    const friendIds = ((requests ?? []) as Request[]).map((request) =>
      request.requester_id === currentUserId ? request.recipient_id : request.requester_id,
    )
    if (friendIds.length === 0) {
      setFriends([])
      return
    }
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, uid, email, display_name, partner_id, partner_name').in('id', friendIds)
    if (profileError) throw profileError
    setFriends((profiles ?? []) as Profile[])
  }

  async function loadRequests(currentUserId: string) {
    if (!supabase) return
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id, requester_id, recipient_id, status, request_type')
      .eq('recipient_id', currentUserId)
      .eq('status', 'pending')
    if (error) throw error
    setIncomingRequests((data ?? []) as Request[])
  }

  useEffect(() => {
    let isMounted = true
    async function load() {
      if (!supabase) {
        setMessage('Supabase is not configured. Add the required environment variables.')
        setIsLoading(false)
        return
      }
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        setMessage(error?.message ?? 'Sign in to manage friends.')
        setIsLoading(false)
        return
      }
      try {
        await Promise.all([loadFriends(data.user.id), loadRequests(data.user.id)])
        if (isMounted) setUserId(data.user.id)
      } catch (loadError) {
        if (isMounted) setMessage(loadError instanceof Error ? loadError.message : 'Unable to load friends.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setSearchResult(null)
    const search = normalizeFriendSearch(searchValue)
    if (!search) {
      setMessage('Enter an email address or UID to search.')
      return
    }
    if (!supabase || !userId) return
    const { data, error } = await supabase.from('profiles').select('id, uid, email, display_name, partner_id, partner_name').eq(search.field, search.value).maybeSingle()
    if (error) {
      setMessage(error.message)
      return
    }
    if (!data || data.id === userId) {
      setMessage('No friend found with that email or UID.')
      return
    }
    setSearchResult(data as Profile)
  }

  async function sendFriendRequest(profile: Profile) {
    if (!supabase || !userId) return
    setMessage('')
    const { data: existing, error: existingError } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('requester_id', userId)
      .eq('recipient_id', profile.id)
      .eq('status', 'pending')
      .maybeSingle()
    if (existingError) {
      setMessage(existingError.message)
      return
    }
    if (existing) {
      setMessage('A request is already pending.')
      return
    }
    const { error } = await supabase.from('friend_requests').insert({ requester_id: userId, recipient_id: profile.id, status: 'pending', request_type: 'friend' })
    setMessage(error ? error.message : `Friend request sent to ${profile.display_name ?? profile.email}.`)
    if (!error) setSearchResult(null)
  }

  async function acceptRequest(request: Request) {
    if (!supabase || !userId) return
    let error: { message: string } | null
    if (request.request_type === 'partner') {
      const [{ data: currentProfile, error: currentProfileError }, { data: requesterProfile, error: requesterProfileError }] = await Promise.all([
        supabase.from('profiles').select('id, uid, email, display_name').eq('id', userId).maybeSingle(),
        supabase.from('profiles').select('id, uid, email, display_name').eq('id', request.requester_id).maybeSingle(),
      ])
      error = currentProfileError ?? requesterProfileError
      if (!error && currentProfile && requesterProfile) {
        const currentName = currentProfile.display_name ?? currentProfile.email
        const requesterName = requesterProfile.display_name ?? requesterProfile.email
        const updates = await Promise.all([
          supabase.from('profiles').update({ partner_id: requesterProfile.id, partner_name: requesterName }).eq('id', currentProfile.id),
          supabase.from('profiles').update({ partner_id: currentProfile.id, partner_name: currentName }).eq('id', requesterProfile.id),
          supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', request.id).eq('recipient_id', userId),
        ])
        error = updates.find((result) => result.error)?.error ?? null
      } else if (!error) {
        error = { message: 'Unable to find both profiles for this partner request.' }
      }
    } else {
      const result = await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', request.id).eq('recipient_id', userId)
      error = result.error
    }
    if (error) {
      setMessage(error.message)
      return
    }
    await Promise.all([loadFriends(userId), loadRequests(userId)])
  }

  async function sendPartnerRequest(friend: Profile) {
    if (!supabase || !userId) return
    const { error } = await supabase.from('friend_requests').insert({ requester_id: userId, recipient_id: friend.id, status: 'pending', request_type: 'partner' })
    setMessage(error ? error.message : `Partner request sent to ${friend.display_name ?? friend.email}.`)
  }

  return (
    <section className="friends-panel" aria-labelledby="friends-title">
      <p className="hub-panel__eyebrow">Your circle</p>
      <h2 id="friends-title">Friends</h2>
      <p className="friends-panel__intro">Find the people who make our little world bigger.</p>
      <form className="friends-search" onSubmit={handleSearch}>
        <label htmlFor="friend-search">Search by email or UID</label>
        <div className="friends-search__row">
          <input id="friend-search" type="text" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="friend@example.com or AB12-CD34" required />
          <button type="submit">Search</button>
        </div>
      </form>
      {searchResult && (
        <div className="friends-card">
          <div><strong>{searchResult.display_name ?? searchResult.email}</strong><span>{searchResult.uid} · {searchResult.email}</span></div>
          <button type="button" onClick={() => void sendFriendRequest(searchResult)}>Send Friend Request</button>
        </div>
      )}
      {message && <p className="friends-message" role="status">{message}</p>}
      <div className="friends-section">
        <h3>Confirmed friends</h3>
        {isLoading ? <p>Loading friends…</p> : friends.length === 0 ? <p>No confirmed friends yet.</p> : friends.map((friend) => (
          <div className="friends-card" key={friend.id}>
            <div><strong>{friend.display_name ?? friend.email}</strong><span>{friend.uid} · {friend.email}</span></div>
            {!friend.partner_id && <button type="button" onClick={() => void sendPartnerRequest(friend)}>Send Partner Request</button>}
          </div>
        ))}
      </div>
      {incomingRequests.length > 0 && (
        <div className="friends-section">
          <h3>Requests waiting for you</h3>
          {incomingRequests.map((request) => <div className="friends-card" key={request.id}><span>{request.request_type === 'partner' ? 'Partner request' : 'Friend request'}</span><button type="button" onClick={() => void acceptRequest(request)}>Accept</button></div>)}
        </div>
      )}
    </section>
  )
}

export default Friends
