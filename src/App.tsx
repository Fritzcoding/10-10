import { useEffect, useState } from 'react'
import AuthModal from './components/AuthModal'
import BirthdayScroll from './components/BirthdayScroll'
import Hub from './components/Hub'
import { ensureCurrentProfile } from './lib/profile'
import { supabase } from './lib/supabase'
import DeveloperPairingHarness from './components/DeveloperPairingHarness'
import { configureAndroidBackend, refreshAndroidWidgets, syncAndroidSession } from './lib/androidSession'
import { supabaseAnonKey, supabaseUrl } from './lib/supabase'
import { subscribeAndroidWidgetRefresh } from './lib/androidWidgetRealtime'

type AppView = 'birthday' | 'auth' | 'hub'

function App() {
  const [view, setView] = useState<AppView>('birthday')
  const [sessionUserId, setSessionUserId] = useState<string>()
  const isDeveloperPairingMode = new URLSearchParams(window.location.search).get('dev') === 'pairing'

  useEffect(() => {
    configureAndroidBackend(supabaseUrl, supabaseAnonKey)
    if (!supabase) return
    const client = supabase
    let isMounted = true
    client.auth.getSession().then(async ({ data }) => {
      syncAndroidSession(data.session)
      setSessionUserId(data.session?.user.id)
      if (data.session) await ensureCurrentProfile(data.session.user)
      if (isMounted && data.session) setView('hub')
    })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      syncAndroidSession(session)
      setSessionUserId(session?.user.id)
      if (session) void ensureCurrentProfile(session.user).then(() => { if (isMounted) setView('hub') })
    })
    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !sessionUserId) return
    const client = supabase
    let cancelled = false
    let stopListening = () => {}
    void client.from('couple_members').select('couple_id').eq('user_id', sessionUserId).maybeSingle()
      .then(async ({ data, error }) => {
        if (error || !data || cancelled) return
        const stop = await subscribeAndroidWidgetRefresh(client, data.couple_id, refreshAndroidWidgets)
        if (cancelled) stop()
        else stopListening = stop
      })
    return () => { cancelled = true; stopListening() }
  }, [sessionUserId])

  if (isDeveloperPairingMode) return <DeveloperPairingHarness />
  if (view === 'birthday') return <BirthdayScroll onContinue={() => setView('auth')} />
  if (view === 'auth') return <AuthModal onAuthenticated={() => setView('hub')} />
  return <Hub onLogout={() => setView('auth')} />
}

export default App
