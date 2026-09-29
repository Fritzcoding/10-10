import { useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type FriendProfile = { id: string; display_name: string; avatar_url: string | null }

export function groupFriendsByPresence(friends: FriendProfile[], onlineUserIds: ReadonlySet<string>) {
  return {
    online: friends.filter((friend) => onlineUserIds.has(friend.id)),
    offline: friends.filter((friend) => !onlineUserIds.has(friend.id)),
  }
}

export function onlineUserIdsFromPresence(state: Record<string, Array<{ user_id?: string }>>): Set<string> {
  return new Set(Object.values(state).flat().map((entry) => entry.user_id).filter((id): id is string => Boolean(id)))
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
        const connected = status === 'SUBSCRIBED'
        setIsConnected(connected)
        if (connected) void presenceChannel.track({ user_id: userId })
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
