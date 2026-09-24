import { useEffect, useState } from 'react'
import AuthModal from './components/AuthModal'
import BirthdayScroll from './components/BirthdayScroll'
import Hub from './components/Hub'
import { supabase } from './lib/supabase'

type AppView = 'birthday' | 'auth' | 'hub'

function App() {
  const [view, setView] = useState<AppView>('birthday')

  useEffect(() => {
    if (!supabase) return
    let isMounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted && data.session) setView('hub')
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setView('hub')
    })
    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (view === 'birthday') return <BirthdayScroll onContinue={() => setView('auth')} />
  if (view === 'auth') return <AuthModal onAuthenticated={() => setView('hub')} />
  return <Hub onLogout={() => setView('auth')} />
}

export default App
