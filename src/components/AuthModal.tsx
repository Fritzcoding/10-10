import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import './AuthModal.css'

type AuthMode = 'login' | 'register'

type AuthModalProps = {
  onAuthenticated: () => void
}

function AuthModal({ onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!supabase) {
      setErrorMessage('Supabase is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
      return
    }

    setIsSubmitting(true)

    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setIsSubmitting(false)

    if (result.error) {
      setErrorMessage(result.error.message)
      return
    }

    if (mode === 'register' && !result.data.session) {
      setErrorMessage('Check your email to confirm your account before signing in.')
      return
    }

    onAuthenticated()
  }

  return (
    <main className="auth-page">
      <div className="auth-backdrop" aria-hidden="true" />
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-eyebrow">Our little place</p>
        <h1 id="auth-title">Welcome back, love</h1>
        <p className="auth-subtitle">
          Sign in to keep our memories and moments close.
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'auth-tab auth-tab--active' : 'auth-tab'}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'auth-tab auth-tab--active' : 'auth-tab'}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {errorMessage && (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          )}

          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Enter our hub' : 'Create account'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default AuthModal
