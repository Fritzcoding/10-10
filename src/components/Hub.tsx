import { useCallback, useEffect, useRef, useState } from 'react'
import { startBackgroundMusic } from '../lib/audio'
import { supabase } from '../lib/supabase'
import BottomNav, { type HubTab } from './BottomNav'
import Friends from './Friends'
import Games from './Games'
import PartnerStatus from './PartnerStatus'
import Settings from './Settings'
import GameRequestBanner from './GameRequestBanner'
import Profile from './Profile'
import './Hub.css'
import './HubTheme.css'
import { isSessionForUser, type GameSession } from '../lib/gameSessions'
import { useGamePresence } from '../lib/gamePresence'
import { formatProfileUid } from '../lib/friendSearch'

type HubProps = { onLogout: () => void }

function Hub({ onLogout }: HubProps) {
  const [activeTab, setActiveTab] = useState<HubTab>('games')
  const [userId, setUserId] = useState<string>()
  const [displayUid, setDisplayUid] = useState<number | null>(null)
  const [activeSession, setActiveSession] = useState<GameSession | null>(null)
  const currentUserId = useRef<string | undefined>(undefined)
  const { onlineUserIds } = useGamePresence(userId)

  const openSession = useCallback((session: GameSession) => {
    setActiveSession(session)
    setActiveTab('games')
  }, [])

  useEffect(() => {
    void startBackgroundMusic()
    if (!supabase) return
    const client = supabase

    let isMounted = true
    const updateUserId = (nextUserId?: string) => {
      if (currentUserId.current === nextUserId) return
      currentUserId.current = nextUserId
      setUserId(nextUserId)
      setDisplayUid(null)
      setActiveSession(null)
    }
    client.auth.getUser().then(({ data }) => { if (isMounted) updateUserId(data.user?.id) })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (isMounted) updateUserId(session?.user.id)
    })
    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !userId) return
    let isMounted = true
    void supabase.from('profiles').select('display_uid').eq('id', userId).maybeSingle().then(({ data }) => {
      if (isMounted) setDisplayUid(data?.display_uid ?? null)
    })
    return () => { isMounted = false }
  }, [userId])

  useEffect(() => {
    if (!supabase || !userId) return
    const client = supabase
    const loadActiveSession = async () => {
      const { data } = await client.from('game_sessions').select('*').or(`player_x_id.eq.${userId},player_o_id.eq.${userId}`).eq('game_type', 'tic-tac-toe').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (data && isSessionForUser(data as GameSession, userId)) openSession(data as GameSession)
    }
    void loadActiveSession()
    const channel = client.channel(`hub-game-sessions-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, () => void loadActiveSession()).subscribe((status) => { if (status === 'SUBSCRIBED') void loadActiveSession() })
    return () => { void client.removeChannel(channel) }
  }, [openSession, userId])

  const loadSession = useCallback(async (sessionId: string) => {
    const { data } = await supabase?.from('game_sessions').select('*').eq('id', sessionId).eq('game_type', 'tic-tac-toe').single() ?? { data: null }
    if (data) openSession(data as GameSession)
  }, [openSession])

  return (
    <main className="hub-page">
      <div className="hub-page__backdrop" aria-hidden="true" />
      <header className="hub-header">
        <div>
          <p className="hub-eyebrow">Our little hub</p>
          <h1>Welcome home, love.</h1>
        </div>
        <div className="hub-header__meta"><span className="hub-uid" aria-label="Your UID">{formatProfileUid(displayUid)}</span><PartnerStatus userId={userId} /></div>
      </header>
      <GameRequestBanner userId={userId} onAccept={(_, sessionId) => void loadSession(sessionId)} />
      <section className="hub-panel" aria-live="polite">
        {activeTab === 'friends' && <Friends />}
        {activeTab === 'profile' && <Profile />}
        {activeTab === 'settings' && <Settings onLogout={onLogout} />}
        {activeTab === 'games' && <Games userId={userId} onlineUserIds={onlineUserIds} activeSession={activeSession} onSessionExit={() => setActiveSession(null)} />}
      </section>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  )
}

export default Hub
