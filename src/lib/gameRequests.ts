import type { GameId } from './gameCatalog.ts'

export type GameRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired'
export type GameRequest = {
  id: string
  requester_id: string
  recipient_id: string
  game_type: GameId
  status: GameRequestStatus
  expires_at: string
  created_at: string
  updated_at: string
}

export function isGameRequestActive(request: Pick<GameRequest, 'status' | 'expires_at'>, now: Date): boolean {
  return request.status === 'pending' && new Date(request.expires_at).getTime() > now.getTime()
}

export function getActiveGameRequests(requests: GameRequest[], now: Date): GameRequest[] {
  return requests.filter((request) => isGameRequestActive(request, now))
}

export function canAcceptGameRequest(request: Pick<GameRequest, 'status' | 'expires_at'>, now: Date): boolean {
  return isGameRequestActive(request, now)
}

export function partitionGameRequests(requests: GameRequest[], userId: string) {
  return {
    incoming: requests.filter((request) => request.recipient_id === userId),
    outgoing: requests.filter((request) => request.requester_id === userId),
  }
}

export function gameRequestPeerId(request: Pick<GameRequest, 'requester_id' | 'recipient_id'>, userId: string): string {
  return request.requester_id === userId ? request.recipient_id : request.requester_id
}

export function gameRequestStatusLabel(request: Pick<GameRequest, 'requester_id' | 'recipient_id' | 'status'>, userId: string): string {
  if (request.status === 'accepted') return 'Accepted'
  if (request.status !== 'pending') return request.status[0].toUpperCase() + request.status.slice(1)
  return request.requester_id === userId ? 'Request sent' : 'Wants to play'
}

export function mergeGameRequests(current: GameRequest[], incoming: GameRequest[]): GameRequest[] {
  const merged = new Map(current.map((request) => [request.id, request]))
  for (const request of incoming) {
    const existing = merged.get(request.id)
    if (!existing || new Date(request.updated_at).getTime() >= new Date(existing.updated_at).getTime()) merged.set(request.id, request)
  }
  return [...merged.values()]
}

export function gameRequestInsertPayload(requesterId: string, recipientId: string, gameType: GameId = 'tic-tac-toe') {
  return { requester_id: requesterId, recipient_id: recipientId, game_type: gameType }
}

export function gameRequestRpcPayload(recipientId: string, gameType: GameId = 'tic-tac-toe') {
  return gameType === 'tic-tac-toe'
    ? { target_recipient_id: recipientId }
    : { target_recipient_id: recipientId, target_game_type: gameType }
}

export function gameRequestAcceptRpcPayload(requestId: string) {
  return { target_request_id: requestId }
}

export function gameRequestDeclineRpcPayload(requestId: string) {
  return { target_request_id: requestId }
}

export async function createGameRequest(recipientId: string, gameType: GameId = 'tic-tac-toe'): Promise<GameRequest & { wasExisting?: boolean }> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) throw new Error(authError?.message ?? 'Sign in before sending a game request.')
  const { data, error } = await supabase.rpc('create_game_request', gameRequestRpcPayload(recipientId, gameType))
  if (error) {
    throw error
  }
  return data as GameRequest
}

export async function acceptGameRequest(requestId: string): Promise<{ request: GameRequest; session_id: string }> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('accept_game_request', gameRequestAcceptRpcPayload(requestId))
  if (error) throw error
  return data as { request: GameRequest; session_id: string }
}

export async function declineGameRequest(requestId: string): Promise<void> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('decline_game_request', gameRequestDeclineRpcPayload(requestId))
  if (error) throw error
}
