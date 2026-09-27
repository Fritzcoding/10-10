import { useEffect, useState } from 'react'
import { startBackgroundMusic } from '../lib/audio'
import { supabase } from '../lib/supabase'
import BottomNav, { type HubTab } from './BottomNav'
import Friends from './Friends'
import Games from './Games'
import PartnerStatus from './PartnerStatus'
import Settings from './Settings'
import GameRequestBanner from './GameRequestBanner'
import './Hub.css'

type HubProps = { onLogout: () => void }

function Hub({ onLogout }: HubProps) {
  const [activeTab, setActiveTab] = useState<HubTab>('games')
  const [userId, setUserId] = useState<string>()

  useEffect(() => {
    void startBackgroundMusic()
    if (!supabase) return

    let isMounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) setUserId(data.user?.id)
    })
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="hub-page">
      <div className="hub-page__backdrop" aria-hidden="true" />
      <header className="hub-header">
        <div>
          <p className="hub-eyebrow">Our little hub</p>
          <h1>Welcome home, love.</h1>
        </div>
        <PartnerStatus userId={userId} />
      </header>
      <GameRequestBanner userId={userId} />
      <section className="hub-panel" aria-live="polite">
        {activeTab === 'friends' && <Friends />}
        {activeTab === 'settings' && <Settings onLogout={onLogout} />}
        {activeTab === 'games' && <Games />}
      </section>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  )
}

export default Hub
