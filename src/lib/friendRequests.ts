export type RequestSummary = {
  id?: string
  requester_id: string
  recipient_id: string
  status: string
}

export function partitionPendingRequests<T extends RequestSummary>(requests: T[], currentUserId: string): { incoming: T[]; outgoing: T[] } {
  return {
    incoming: requests.filter((request) => request.status === 'pending' && request.recipient_id === currentUserId),
    outgoing: requests.filter((request) => request.status === 'pending' && request.requester_id === currentUserId),
  }
}

export function hasPendingRequest(requests: RequestSummary[], currentUserId: string, otherUserId: string): boolean {
  return requests.some((request) =>
    request.status === 'pending'
      && ((request.requester_id === currentUserId && request.recipient_id === otherUserId)
        || (request.requester_id === otherUserId && request.recipient_id === currentUserId)),
  )
}
