export type FriendRequestRow = { requester_id: string; recipient_id: string; status: string }

export function acceptedFriendIds(rows: FriendRequestRow[], userId: string): string[] {
  return [...new Set(rows.filter((row) => row.status === 'accepted').map((row) => row.requester_id === userId ? row.recipient_id : row.requester_id))]
}

export function pairedLabel(partnerId: string | null | undefined, partnerName: string | null | undefined): string {
  return partnerId ? `Paired with ${partnerName || 'your partner'}` : 'Not paired yet'
}

export function profileViewModel(profile: { display_name?: string | null; display_uid?: number | null; avatar_url?: string | null; partner_id?: string | null; partner_name?: string | null }) {
  return {
    displayName: profile.display_name ?? '', uid: profile.display_uid ?? null, avatarUrl: profile.avatar_url ?? null,
    partner: pairedLabel(profile.partner_id, profile.partner_name), badges: [], upcoming: true,
  }
}
