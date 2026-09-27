import test from 'node:test'
import assert from 'node:assert/strict'
import { getBrowserNotificationSupport, notifyGameRequest } from '../src/lib/browserNotifications.ts'

test('reports unsupported browser and returns false without throwing', async () => {
  const original = globalThis.Notification
  // @ts-expect-error test environment intentionally lacks Notification
  delete globalThis.Notification
  assert.deepEqual(getBrowserNotificationSupport(), { canNotify: false, permission: 'unsupported' })
  assert.equal(await notifyGameRequest('Play', 'Join', {}), false)
  if (original) globalThis.Notification = original
})

test('does not dispatch when notification permission is denied', async () => {
  class DeniedNotification { static permission = 'denied' as NotificationPermission }
  // @ts-expect-error test replacement
  globalThis.Notification = DeniedNotification
  assert.equal(await notifyGameRequest('Play', 'Join', {}), false)
})

test('dispatches when notification permission is granted', async () => {
  let called = false
  class GrantedNotification { static permission = 'granted' as NotificationPermission; constructor() { called = true } }
  // @ts-expect-error test replacement
  globalThis.Notification = GrantedNotification
  assert.equal(await notifyGameRequest('Play', 'Join', {}), true)
  assert.equal(called, true)
})
