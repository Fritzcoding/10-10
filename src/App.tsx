import { useEffect, useState } from 'react'
import AuthModal from './components/AuthModal'
import BirthdayScroll from './components/BirthdayScroll'
import { supabase } from './lib/supabase'

type AppView = 'birthday' | 'auth' | 'hub'

function App() {
  const [view, setView] = useState<AppView>('birthday')

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted && data.session) {
        setView('hub')
      }
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setView('hub')
      }
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (view === 'birthday') {
    return <BirthdayScroll onContinue={() => setView('auth')} />
  }

  if (view === 'auth') {
    return <AuthModal onAuthenticated={() => setView('hub')} />
  }

  return (
    <main className="birthday-page birthday-page--accepted">
      <section className="birthday-thanks" aria-live="polite">
        <span className="birthday-thanks__heart" aria-hidden="true">
          ♥
        </span>
        <p className="birthday-eyebrow">Our little hub</p>
        <h1>Welcome to our memories.</h1>
        <p className="birthday-thanks__copy">
          Everything lovely we make together can live here.
        </p>
      </section>
    </main>
  )
}

export default App
