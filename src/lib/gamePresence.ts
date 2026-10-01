import { useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type FriendProfile = { id: string; display_name: string; avatar_url: string | null; email?: string | null; display_uid?: number | null }

export function friendDisplayName(profile: { id: string; display_name?: string | null; email?: string | null; display_uid?: number | null }): string {
  const displayName = profile.display_name?.trim()
  if (displayName) return displayName
  const email = profile.email?.trim()
  if (email) return email
  if (profile.display_uid !== null && profile.display_uid !== undefined) return `UID #${profile.display_uid}`
  return 'Friend'
}

export function groupFriendsByPresence(friends: FriendProfile[], onlineUserIds: ReadonlySet<string>) {
  return {
    online: friends.filter((friend) => onlineUserIds.has(friend.id)),
    offline: friends.filter((friend) => !onlineUserIds.has(friend.id)),
  }
}

export function onlineFriendNames(friends: FriendProfile[], onlineUserIds: ReadonlySet<string>): string[] {
  return friends.filter((friend) => onlineUserIds.has(friend.id)).map((friend) => friend.display_name)
}

export function onlineUserIdsFromPresence(state: Record<string, Array<{ user_id?: string }>>): Set<string> {
  return new Set(Object.values(state).flat().map((entry) => entry.user_id).filter((id): id is string => Boolean(id)))
}

export type PresenceConnectionState = 'connected' | 'disconnected' | 'error'

export function presenceConnectionState(status: string): PresenceConnectionState {
  if (status === 'SUBSCRIBED') return 'connected'
  if (status === 'CLOSED') return 'disconnected'
  return 'error'
}

export function useGamePresence(userId?: string) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!userId) return
    let active = true
    let channel: RealtimeChannel | undefined
    void import('./supabase.ts').then(({ supabase }) => {
      if (!active || !supabase) return
      const presenceChannel = supabase.channel('game-presence', { config: { presence: { key: userId } } })
      channel = presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState() as Record<string, Array<{ user_id?: string }>>
          setOnlineUserIds(onlineUserIdsFromPresence(state))
        })
      channel.subscribe((status: string) => {
        if (!active) return
        const state = presenceConnectionState(status)
        setIsConnected(state === 'connected')
        if (state === 'connected') {
          void presenceChannel.track({ user_id: userId }).catch(() => {
            if (active) setIsConnected(false)
          })
        }
      })
    })
    return () => {
      active = false
      setIsConnected(false)
      setOnlineUserIds(new Set())
      if (channel) {
        const cleanupChannel = channel
        void import('./supabase.ts').then(({ supabase }) => supabase?.removeChannel(cleanupChannel))
      }
    }
  }, [userId])

  return { onlineUserIds, isConnected }
}
