import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { appendUniqueMessage, isConversationMessage, type ChatMessage } from '../lib/chat'
import { hasPendingRequest, partitionPendingRequests } from '../lib/friendRequests'
import { executeProfileSearch, friendRequestStatusLabel, formatProfileUid, profileSearchFields, profileSearchReadiness } from '../lib/friendSearch'
import { ensureCurrentProfile } from '../lib/profile'
import { supabase } from '../lib/supabase'
import { formatSupabaseDataError } from '../lib/supabaseErrors'
import './Friends.css'

type Profile = { id: string; display_uid: number; email: string; display_name: string | null; partner_id?: string | null; partner_name?: string | null }
type Request = { id: string; requester_id: string; recipient_id: string; status: string; request_type?: string; other?: Profile }
type RequestRow = Omit<Request, 'other'>

const profileFields = 'id, display_uid, email, display_name, partner_id, partner_name'

function profileLabel(profile: Profile | undefined) {
  return profile?.display_name ?? profile?.email ?? 'Unknown account'
}

function Friends() {
  const [userId, setUserId] = useState<string>()
  const [friends, setFriends] = useState<Profile[]>([])
  const [incomingRequests, setIncomingRequests] = useState<Request[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<Request[]>([])
  const [allRequests, setAllRequests] = useState<Request[]>([])
  const [displayUid, setDisplayUid] = useState<number | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [searchResult, setSearchResult] = useState<Profile | null>(null)
  const [chatProfile, setChatProfile] = useState<Profile | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatDraft, setChatDraft] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !userId || !chatProfile) return

    let isMounted = true
    const client = supabase
    const currentUserId = userId
    const selectedProfile = chatProfile
    async function loadChat() {
      setIsChatLoading(true)
      try {
        const { data, error } = await client
          .from('direct_messages')
          .select('id, sender_id, recipient_id, body, created_at')
          .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${selectedProfile.id}),and(sender_id.eq.${selectedProfile.id},recipient_id.eq.${currentUserId})`)
          .order('created_at', { ascending: true })
        if (error) throw error
        if (isMounted) setChatMessages(((data ?? []) as ChatMessage[]).filter((message) => isConversationMessage(message, currentUserId, selectedProfile.id)))
      } catch (chatError) {
        if (isMounted) setMessage(formatSupabaseDataError(chatError as { message?: string }))
      } finally {
        if (isMounted) setIsChatLoading(false)
      }
    }

    void loadChat()
    const channel = client
      .channel(`direct-chat:${currentUserId}:${selectedProfile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        const message = payload.new as ChatMessage
        if (isMounted && isConversationMessage(message, currentUserId, selectedProfile.id)) {
          setChatMessages((current) => appendUniqueMessage(current, message))
        }
      })
      .subscribe()

    return () => {
      isMounted = false
      void client.removeChannel(channel)
    }
  }, [chatProfile, userId])

  async function loadFriends(currentUserId: string) {
    if (!supabase) return
    const { data: requests, error } = await supabase
      .from('friend_requests')
      .select('id, requester_id, recipient_id, status, request_type')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
    if (error) throw error

    const friendIds = ((requests ?? []) as RequestRow[]).map((request) => request.requester_id === currentUserId ? request.recipient_id : request.requester_id)
    if (friendIds.length === 0) {
      setFriends([])
      return
    }
    const { data: profiles, error: profileError } = await supabase.from('profiles').select(profileFields).in('id', friendIds)
    if (profileError) throw profileError
    setFriends((profiles ?? []) as Profile[])
  }

  async function loadRequests(currentUserId: string) {
    if (!supabase) return
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id, requester_id, recipient_id, status, request_type')
      .eq('status', 'pending')
      .or(`requester_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
    if (error) throw error

    const rows = (data ?? []) as RequestRow[]
    const profileIds = [...new Set(rows.map((request) => request.requester_id === currentUserId ? request.recipient_id : request.requester_id))]
    const { data: profiles, error: profileError } = profileIds.length
      ? await supabase.from('profiles').select(profileFields).in('id', profileIds)
      : { data: [], error: null }
    if (profileError) setMessage(formatSupabaseDataError(profileError))
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile as Profile]))
    const requests = rows.map((request) => ({ ...request, other: profileMap.get(request.requester_id === currentUserId ? request.recipient_id : request.requester_id) }))
    const partitionedRequests = partitionPendingRequests(requests, currentUserId)
    setAllRequests(requests)
    setIncomingRequests(partitionedRequests.incoming)
    setOutgoingRequests(partitionedRequests.outgoing)
  }

  async function refresh(currentUserId: string) {
    const results = await Promise.allSettled([loadFriends(currentUserId), loadRequests(currentUserId)])
    const failedLoad = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (failedLoad) throw failedLoad.reason
  }

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        if (!supabase) {
          setMessage('Supabase is not configured. Add the required environment variables.')
          return
        }
        const { data, error } = await supabase.auth.getUser()
        if (error || !data.user) {
          setMessage(error?.message ?? 'Sign in to manage friends.')
          return
        }
        const profileResult = await ensureCurrentProfile(data.user)
        if (profileResult.error) throw profileResult.error
        if (isMounted) {
          setDisplayUid(profileResult.profile?.display_uid ?? null)
          setUserId(data.user.id)
        }
        await refresh(data.user.id)
      } catch (loadError) {
        if (isMounted) setMessage(formatSupabaseDataError(loadError instanceof Error ? loadError : { message: 'Unable to load friends.' }))
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    void load()
    return () => { isMounted = false }
  // `refresh` is stable for this mount and intentionally uses the authenticated user loaded above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openChat(profile: Profile) {
    setChatMessages([])
    setChatProfile(profile)
  }

  function closeChat() {
    setChatProfile(null)
    setChatMessages([])
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setSearchResult(null)
    const readinessMessage = profileSearchReadiness(Boolean(supabase), userId)
    if (readinessMessage) {
      setMessage(readinessMessage)
      return
    }
    if (!supabase || !userId) return
    const client = supabase
    const currentUserId = userId
    setIsLoading(true)
    try {
      const input = searchValue.trim()
      const data = await executeProfileSearch<Profile>(input, async (target) => {
        const result = target.field === 'display_uid'
          ? await client.from('profiles').select(profileSearchFields).eq('display_uid', target.value).maybeSingle()
          : await client.from('profiles').select(profileSearchFields).ilike('email', String(target.value)).maybeSingle()
        return { data: result.data as Profile | null, error: result.error }
      })
      if (!data || data.id === currentUserId) {
        setMessage('No other account found with that email or display UID.')
        return
      }
      setSearchResult(data as Profile)
    } catch (searchError) {
      setMessage(searchError instanceof Error ? searchError.message : 'Unable to search profiles.')
    } finally {
      setIsLoading(false)
    }
  }

  async function sendFriendRequest(profile: Profile) {
    if (!supabase || !userId) return
    setMessage('')
    if (friends.some((friend) => friend.id === profile.id)) {
      setMessage('You are already friends.')
      return
    }
    if (hasPendingRequest(allRequests, userId, profile.id)) {
      setMessage('A request is already pending.')
      return
    }
    const { data: existing, error: existingError } = await supabase
      .from('friend_requests')
      .select('requester_id, recipient_id, status')
      .eq('status', 'pending')
      .or(`and(requester_id.eq.${userId},recipient_id.eq.${profile.id}),and(requester_id.eq.${profile.id},recipient_id.eq.${userId})`)
    if (existingError) {
      setMessage(formatSupabaseDataError(existingError))
      return
    }
    if (hasPendingRequest((existing ?? []) as RequestRow[], userId, profile.id)) {
      setMessage('A request is already pending.')
      return
    }
    const { error } = await supabase.from('friend_requests').insert({ requester_id: userId, recipient_id: profile.id, status: 'pending', request_type: 'friend' })
    setMessage(error ? formatSupabaseDataError(error) : `Friend request sent to ${profileLabel(profile)}.`)
    if (!error) {
      await loadRequests(userId)
    }
  }

  async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = chatDraft.trim()
    if (!supabase || !userId || !chatProfile || !body) return

    setIsChatLoading(true)
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({ sender_id: userId, recipient_id: chatProfile.id, body })
        .select('id, sender_id, recipient_id, body, created_at')
        .single()
      if (error) throw error
      setChatMessages((current) => appendUniqueMessage(current, data as ChatMessage))
      setChatDraft('')
    } catch (chatError) {
      setMessage(formatSupabaseDataError(chatError as { message?: string }))
    } finally {
      setIsChatLoading(false)
    }
  }

  async function acceptRequest(request: Request) {
    if (!supabase || !userId) return
    let error: { message: string } | null
    if (request.request_type === 'partner') {
      const [{ data: currentProfile, error: currentProfileError }, { data: requesterProfile, error: requesterProfileError }] = await Promise.all([
        supabase.from('profiles').select('id, display_uid, email, display_name').eq('id', userId).maybeSingle(),
        supabase.from('profiles').select('id, display_uid, email, display_name').eq('id', request.requester_id).maybeSingle(),
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
      setMessage(formatSupabaseDataError(error))
      return
    }
    setMessage(request.request_type === 'partner' ? 'Partner request accepted.' : 'Friend request accepted.')
    await refresh(userId)
  }

  async function sendPartnerRequest(friend: Profile) {
    if (!supabase || !userId) return
    setMessage('')
    if (friend.partner_id) {
      setMessage('This friend already has a partner connection.')
      return
    }
    const { data: existing, error: existingError } = await supabase
      .from('friend_requests')
      .select('requester_id, recipient_id, status')
      .eq('request_type', 'partner')
      .eq('status', 'pending')
      .or(`and(requester_id.eq.${userId},recipient_id.eq.${friend.id}),and(requester_id.eq.${friend.id},recipient_id.eq.${userId})`)
    if (existingError) {
      setMessage(formatSupabaseDataError(existingError))
      return
    }
    if (hasPendingRequest((existing ?? []) as RequestRow[], userId, friend.id)) {
      setMessage('A partner request is already pending.')
      return
    }
    const { error } = await supabase.from('friend_requests').insert({ requester_id: userId, recipient_id: friend.id, status: 'pending', request_type: 'partner' })
    setMessage(error ? formatSupabaseDataError(error) : `Partner request sent to ${profileLabel(friend)}.`)
    if (!error) await loadRequests(userId)
  }

  return (
    <section className="friends-panel" aria-labelledby="friends-title">
      <p className="hub-panel__eyebrow">Your circle</p>
      <h2 id="friends-title">Friends</h2>
      <p className="friends-panel__intro">See your people, manage requests, and find someone new by UID.</p>
      <p className="friends-panel__uid">{formatProfileUid(displayUid)}</p>

      <div className="friends-section">
        <h3>Your friends</h3>
        {isLoading ? <p>Loading friends…</p> : friends.length === 0 ? <p>No confirmed friends yet.</p> : friends.map((friend) => (
          <div className="friends-card" key={friend.id}>
            <div><strong>{profileLabel(friend)}</strong><span>UID: #{friend.display_uid} · {friend.email}</span></div>
            <div className="friends-card__actions">
              <button type="button" onClick={() => openChat(friend)}>Chat</button>
              {!friend.partner_id && <button type="button" onClick={() => void sendPartnerRequest(friend)}>Partner Request</button>}
            </div>
          </div>
        ))}
      </div>

      <form className="friends-search" onSubmit={handleSearch}>
        <div><h3>Find someone</h3><p>Search for another account using their UID.</p></div>
        <div className="friends-search__row">
          <label className="sr-only" htmlFor="friend-search">Search by UID</label>
          <input id="friend-search" type="text" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="email@example.com or 42" required />
          <button type="submit">Search</button>
        </div>
      </form>
      {searchResult && (
        <div className="friends-card">
          <div><strong>{profileLabel(searchResult)}</strong><span>UID: #{searchResult.display_uid} · {searchResult.email}</span></div>
          <div className="friends-card__actions">
            <button type="button" onClick={() => openChat(searchResult)}>Chat</button>
            <button type="button" disabled={friends.some((friend) => friend.id === searchResult.id) || hasPendingRequest(allRequests, userId ?? '', searchResult.id)} onClick={() => void sendFriendRequest(searchResult)}>{friendRequestStatusLabel(friends.some((friend) => friend.id === searchResult.id), hasPendingRequest(allRequests, userId ?? '', searchResult.id))}</button>
          </div>
        </div>
      )}

      {chatProfile && (
        <div className="friends-chat" aria-labelledby="friends-chat-title">
          <div className="friends-chat__header">
            <div><h3 id="friends-chat-title">Chat with {profileLabel(chatProfile)}</h3><span>UID: #{chatProfile.display_uid}</span></div>
            <button type="button" onClick={closeChat}>Close</button>
          </div>
          <div className="friends-chat__messages" aria-live="polite">
            {isChatLoading && chatMessages.length === 0 && <p>Loading chat…</p>}
            {!isChatLoading && chatMessages.length === 0 && <p>No messages yet. Say hello.</p>}
            {chatMessages.map((chatMessage) => <p className={chatMessage.sender_id === userId ? 'friends-chat__message friends-chat__message--mine' : 'friends-chat__message'} key={chatMessage.id}>{chatMessage.body}</p>)}
          </div>
          <form className="friends-chat__composer" onSubmit={(event) => void sendChatMessage(event)}>
            <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Write a message" maxLength={2000} aria-label="Chat message" />
            <button type="submit" disabled={isChatLoading || !chatDraft.trim()}>Send</button>
          </form>
        </div>
      )}

      <div className="friends-section">
        <h3>Requests</h3>
        {incomingRequests.length === 0 && outgoingRequests.length === 0 && <p>No pending requests.</p>}
        {incomingRequests.map((request) => <div className="friends-card" key={request.id}><div><strong>{profileLabel(request.other)}</strong><span>{request.request_type === 'partner' ? 'Partner request' : 'Friend request'}</span></div><button type="button" onClick={() => void acceptRequest(request)}>Accept</button></div>)}
        {outgoingRequests.map((request) => <div className="friends-card friends-card--muted" key={request.id}><div><strong>{profileLabel(request.other)}</strong><span>{request.request_type === 'partner' ? 'Partner request sent' : 'Friend request sent'}</span></div><span>Pending</span></div>)}
      </div>
      {message && <p className="friends-message" role="status">{message}</p>}
    </section>
  )
}

export default Friends
