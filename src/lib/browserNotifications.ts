export type BrowserNotificationSupport = { canNotify: boolean; permission: NotificationPermission | 'unsupported' }

export function getBrowserNotificationSupport(): BrowserNotificationSupport {
  if (typeof Notification === 'undefined') return { canNotify: false, permission: 'unsupported' }
  return { canNotify: Notification.permission === 'granted', permission: Notification.permission }
}

export async function notifyGameRequest(title: string, body: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
    new Notification(title, { body, data })
    return true
  } catch { return false }
}
