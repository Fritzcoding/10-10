import type { Session } from '@supabase/supabase-js'

type AndroidSessionBridge = {
  configureBackend: (url: string, anonKey: string) => void
  setSession: (accessToken: string, refreshToken: string, expiresAt: number) => void
  clearSession: () => void
  refreshWidgets?: () => void
}

function getAndroidSessionBridge() {
  return (globalThis as typeof globalThis & { AndroidSession?: AndroidSessionBridge }).AndroidSession
}

export function syncAndroidSession(session: Pick<Session, 'access_token' | 'refresh_token' | 'expires_at'> | null) {
  const bridge = getAndroidSessionBridge()
  if (!bridge) return
  if (!session?.access_token || !session.refresh_token) {
    bridge.clearSession()
    return
  }
  bridge.setSession(session.access_token, session.refresh_token, session.expires_at ?? 0)
  bridge.refreshWidgets?.()
}

export function configureAndroidBackend(url?: string, anonKey?: string) {
  if (url && anonKey) getAndroidSessionBridge()?.configureBackend(url, anonKey)
}

export function clearAndroidSession() {
  getAndroidSessionBridge()?.clearSession()
}

export function refreshAndroidWidgets() {
  getAndroidSessionBridge()?.refreshWidgets?.()
}
