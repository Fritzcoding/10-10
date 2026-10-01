import { applyRemoteMove, type GameSession } from './gameSessions.ts'
import type { Board } from './ticTacToe.ts'

export type DeveloperGameRequest = {
  id: string
  requester_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'expired'
  expires_at: string
}

export type DeveloperPairingState = {
  requests: DeveloperGameRequest[]
  session: GameSession | null
}

const emptyBoard = (): Board => [null, null, null, null, null, null, null, null, null]

export function createDeveloperPairingState(): DeveloperPairingState {
  return { requests: [], session: null }
}

export function sendDeveloperGameRequest(state: DeveloperPairingState, requesterId: string, recipientId: string, now: Date): DeveloperPairingState {
  const existing = state.requests.find((request) => request.requester_id === requesterId && request.recipient_id === recipientId && request.status === 'pending' && new Date(request.expires_at) > now)
  if (existing) return state
  const id = `dev-request-${state.requests.length + 1}`
  return { ...state, requests: [...state.requests, { id, requester_id: requesterId, recipient_id: recipientId, status: 'pending', expires_at: new Date(now.getTime() + 60_000).toISOString() }] }
}

export function acceptDeveloperGameRequest(state: DeveloperPairingState, requestId: string, userId: string, now: Date): DeveloperPairingState {
  const request = state.requests.find((item) => item.id === requestId)
  if (!request || request.status !== 'pending') throw new Error('Request is not pending')
  if (request.recipient_id !== userId) throw new Error('Only the recipient can accept this request')
  if (new Date(request.expires_at) <= now) throw new Error('Request expired')
  const session: GameSession = { id: 'dev-session-1', game_type: 'tic-tac-toe', player_x_id: request.requester_id, player_o_id: request.recipient_id, board: emptyBoard(), turn: 'X', status: 'active', winner: null, revision: 0 }
  return { session, requests: state.requests.map((item) => item.id === requestId ? { ...item, status: 'accepted' } : item) }
}

export function applyDeveloperMove(state: DeveloperPairingState, userId: string, index: number): DeveloperPairingState {
  if (!state.session) throw new Error('No active game')
  return { ...state, session: applyRemoteMove(state.session, userId, index) }
}
