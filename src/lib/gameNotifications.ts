import { mergeGameRequests, type GameRequest } from './gameRequests.ts'

export type GameNotification = {
  id: string; user_id: string; kind: 'game_request'; game_request_id: string | null; title: string; body: string
  read_at: string | null; created_at: string; expires_at?: string
}

export function mergeUniqueGameRequests(current: GameRequest[], incoming: GameRequest[]): GameRequest[] {
  return mergeGameRequests(current, incoming)
}

export function unreadNotificationCount(notifications: GameNotification[]): number {
  return notifications.filter((notification) => !notification.read_at).length
}

export function isExpiredNotification(notification: Pick<GameNotification, 'expires_at'>, now: Date): boolean {
  return Boolean(notification.expires_at && new Date(notification.expires_at).getTime() <= now.getTime())
}
