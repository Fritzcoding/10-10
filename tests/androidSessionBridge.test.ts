import test from 'node:test'
import assert from 'node:assert/strict'
import { clearAndroidSession, configureAndroidBackend, syncAndroidSession } from '../src/lib/androidSession.ts'

test('sends the active Supabase session to Android and clears it on sign-out', () => {
  const calls: unknown[][] = []
  Object.defineProperty(globalThis, 'AndroidSession', {
    configurable: true,
    value: {
      configureBackend: (...args: unknown[]) => calls.push(['config', ...args]),
      setSession: (...args: unknown[]) => calls.push(['set', ...args]),
      clearSession: () => calls.push(['clear']),
      refreshWidgets: () => calls.push(['refresh']),
    },
  })

  configureAndroidBackend('https://example.supabase.co', 'public-anon-key')
  syncAndroidSession({ access_token: 'access', refresh_token: 'refresh', expires_at: 123 })
  assert.deepEqual(calls, [['config', 'https://example.supabase.co', 'public-anon-key'], ['set', 'access', 'refresh', 123], ['refresh']])
  clearAndroidSession()
  assert.deepEqual(calls[3], ['clear'])
  delete (globalThis as typeof globalThis & { AndroidSession?: unknown }).AndroidSession
})

test('auth events are safe in browsers without the native bridge', () => {
  delete (globalThis as typeof globalThis & { AndroidSession?: unknown }).AndroidSession
  assert.doesNotThrow(() => syncAndroidSession({ access_token: 'access', refresh_token: 'refresh', expires_at: 123 }))
  assert.doesNotThrow(clearAndroidSession)
})
