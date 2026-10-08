import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

type Client = Pick<SupabaseClient, 'channel' | 'removeChannel' | 'realtime'>

const broadcasts = [
  ['shared-calendar', '*'],
  ['relationship-milestones', '*'],
  ['relationship-rituals', 'mood_refresh'],
  ['temporary-location', 'location_refresh'],
  ['love-board', 'board_refresh'],
] as const

export async function subscribeAndroidWidgetRefresh(client: Client, coupleId: string, refresh: () => void) {
  await client.realtime.setAuth()
  const channels: RealtimeChannel[] = broadcasts.map(([topic, event]) =>
    client.channel(`${topic}:${coupleId}`, { config: { private: true } })
      .on('broadcast', { event }, refresh)
      .subscribe(),
  )
  channels.push(client.channel(`android-widget-refresh:love-notes:${coupleId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'love_notes', filter: `couple_id=eq.${coupleId}`,
    }, refresh)
    .subscribe())
  return () => channels.forEach((channel) => { void client.removeChannel(channel) })
}
