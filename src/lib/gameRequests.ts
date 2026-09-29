export type GameRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired'
export type GameRequest = {
  id: string
  requester_id: string
  recipient_id: string
  game_type: 'tic-tac-toe'
  status: GameRequestStatus
  expires_at: string
  created_at: string
  updated_at: string
}

export function isGameRequestActive(request: Pick<GameRequest, 'status' | 'expires_at'>, now: Date): boolean {
  return request.status === 'pending' && new Date(request.expires_at).getTime() > now.getTime()
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

export function mergeGameRequests(current: GameRequest[], incoming: GameRequest[]): GameRequest[] {
  const merged = new Map(current.map((request) => [request.id, request]))
  for (const request of incoming) {
    const existing = merged.get(request.id)
    if (!existing || new Date(request.updated_at).getTime() >= new Date(existing.updated_at).getTime()) merged.set(request.id, request)
  }
  return [...merged.values()]
}

export function gameRequestInsertPayload(requesterId: string, recipientId: string) {
  return { requester_id: requesterId, recipient_id: recipientId, game_type: 'tic-tac-toe' as const }
}

export async function createGameRequest(recipientId: string): Promise<GameRequest> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) throw new Error(authError?.message ?? 'Sign in before sending a game request.')
  const { data, error } = await supabase.from('game_requests').insert(gameRequestInsertPayload(authData.user.id, recipientId)).select().single()
  if (error) throw error
  return data as GameRequest
}

export async function acceptGameRequest(requestId: string): Promise<{ request: GameRequest; session_id: string }> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('accept_game_request', { request_id: requestId })
  if (error) throw error
  return data as { request: GameRequest; session_id: string }
}

export async function declineGameRequest(requestId: string): Promise<void> {
  const { supabase } = await import('./supabase.ts')
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('game_requests').update({ status: 'declined' }).eq('id', requestId).eq('status', 'pending')
  if (error) throw error
}
