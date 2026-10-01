import { isExpiredNotification, unreadNotificationCount, type GameNotification } from './gameNotifications.ts'
import type { GameRequest } from './gameRequests.ts'

export type RequestAction = 'accept' | 'decline'

export function requestActionLabel(action: RequestAction, isPending: boolean): string {
  if (!isPending) return action === 'accept' ? 'Accept' : 'Decline'
  return action === 'accept' ? 'Accepting…' : 'Declining…'
}

export function requestSenderName(request: Pick<GameRequest, 'requester_id'>, names: Record<string, string>): string {
  return names[request.requester_id] ?? 'A friend'
}

export function formatRemainingTime(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

export function buildGameRequestBannerModel(requests: GameRequest[], notifications: GameNotification[], now: Date, userId: string) {
  return {
    requests: requests.filter((request) => request.recipient_id === userId && request.status === 'pending' && new Date(request.expires_at) > now)
      .map((request) => ({ request, remainingSeconds: Math.ceil((new Date(request.expires_at).getTime() - now.getTime()) / 1000) })),
    unreadCount: unreadNotificationCount(notifications.filter((notification) => !isExpiredNotification(notification, now))),
  }
}
