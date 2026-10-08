import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { subscribeAndroidWidgetRefresh } from '../src/lib/androidWidgetRealtime.ts'

test('Android widget refresh subscribes to private feature signals and scoped love notes', async () => {
  let authReady = false
  let refreshes = 0
  const channels: Array<{ topic: string; options?: unknown; events: Array<{ type: string; filter: Record<string, string>; callback: () => void }> }> = []
  const removed: unknown[] = []
  const client = {
    realtime: { setAuth: async () => { authReady = true } },
    channel: (topic: string, options?: unknown) => {
      assert.equal(authReady, true)
      const entry = { topic, options, events: [] as Array<{ type: string; filter: Record<string, string>; callback: () => void }> }
      channels.push(entry)
      const api = {
        on: (type: string, filter: Record<string, string>, callback: () => void) => { entry.events.push({ type, filter, callback }); return api },
        subscribe: () => entry,
      }
      return api
    },
    removeChannel: (channel: unknown) => { removed.push(channel); return Promise.resolve('ok') },
  }
  const stop = await subscribeAndroidWidgetRefresh(client as never, 'couple-123', () => { refreshes += 1 })

  assert.deepEqual(channels.map(({ topic }) => topic), [
    'shared-calendar:couple-123',
    'relationship-milestones:couple-123',
    'relationship-rituals:couple-123',
    'temporary-location:couple-123',
    'love-board:couple-123',
    'android-widget-refresh:love-notes:couple-123',
  ])
  for (const channel of channels.slice(0, 5)) {
    assert.deepEqual(channel.options, { config: { private: true } })
    channel.events[0].callback()
  }
  assert.equal(channels[5].events[0].type, 'postgres_changes')
  assert.equal(channels[5].events[0].filter.filter, 'couple_id=eq.couple-123')
  channels[5].events[0].callback()
  assert.equal(refreshes, 6)

  stop()
  assert.equal(removed.length, 6)
  assert.match(readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), /subscribeAndroidWidgetRefresh/)
})
