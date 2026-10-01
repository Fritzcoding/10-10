import { useCallback, useEffect, useState } from 'react'
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
    client.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await client.from('profiles').select('display_uid').eq('id', data.user.id).maybeSingle()
      if (isMounted) { setUserId(data.user.id); setDisplayUid(profile?.display_uid ?? null) }
    })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!supabase || !userId) return
    const client = supabase
    const loadActiveSession = async () => {
      const { data } = await client.from('game_sessions').select('*').or(`player_x_id.eq.${userId},player_o_id.eq.${userId}`).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (data && isSessionForUser(data as GameSession, userId)) openSession(data as GameSession)
    }
    void loadActiveSession()
    const channel = client.channel(`hub-game-sessions-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, () => void loadActiveSession()).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [openSession, userId])

  const loadSession = useCallback(async (sessionId: string) => {
    const { data } = await supabase?.from('game_sessions').select('*').eq('id', sessionId).single() ?? { data: null }
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
        {activeTab === 'games' && <Games userId={userId} onlineUserIds={onlineUserIds} activeSession={activeSession} />}
      </section>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  )
}

export default Hub
