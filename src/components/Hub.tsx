import { useEffect, useState } from 'react'
import { startBackgroundMusic } from '../lib/audio'
import { supabase } from '../lib/supabase'
import BottomNav, { type HubTab } from './BottomNav'
import PartnerStatus from './PartnerStatus'
import './Hub.css'

function Hub() {
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

  const panelCopy = {
    games: ['Play together', 'A little fun for two.', 'Choose a game and make a new memory together.'],
    friends: ['Your circle', 'The people we love.', 'Your shared friend space will live here soon.'],
    settings: ['Make it yours', 'Our space, our way.', 'Personalize the little details of your hub.'],
  }[activeTab]

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
      <section className="hub-panel" aria-live="polite">
        <p className="hub-panel__eyebrow">{panelCopy[0]}</p>
        <h2>{panelCopy[1]}</h2>
        <p>{panelCopy[2]}</p>
      </section>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  )
}

export default Hub
