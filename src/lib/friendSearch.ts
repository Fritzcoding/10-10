export type FriendSearch = {
  field: 'email' | 'uid'
  value: string
}

export type ProfileSearchTarget = {
  field: 'email' | 'display_uid'
  value: string | number
}

export const profileSearchFields = 'id, display_uid, email, display_name'

export type ProfileSearchResult<T> = { data: T | null; error: { message: string } | null }

export function profileSearchReadiness(supabaseConfigured: boolean, userId: string | undefined): string | null {
  if (!supabaseConfigured) return 'Supabase is not configured. Add the required environment variables.'
  if (!userId) return 'Your profile is still loading. Try searching again in a moment.'
  return null
}

export async function executeProfileSearch<T>(input: string, execute: (target: ProfileSearchTarget) => Promise<ProfileSearchResult<T>>): Promise<T | null> {
  const target = profileSearchTarget(input)
  if (!target) throw new Error('Enter an email or display UID to search.')
  const result = await execute(target)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export function friendRequestStatusLabel(isFriend: boolean, hasPendingRequest: boolean): string {
  if (isFriend) return 'Friends'
  if (hasPendingRequest) return 'Request sent'
  return 'Add Friend'
}

export function formatProfileUid(displayUid: number | null | undefined): string {
  return displayUid === null || displayUid === undefined ? 'UID: #--' : `UID: #${displayUid}`
}

export function normalizeProfileSearchInput(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  return value.includes('@') ? value.toLowerCase() : value
}

export function profileSearchTarget(input: string): ProfileSearchTarget | null {
  const normalized = normalizeProfileSearchInput(input)
  if (!normalized) return null
  if (/^\d+$/.test(normalized)) return { field: 'display_uid', value: Number(normalized) }
  return { field: 'email', value: normalized }
}

export function normalizeFriendSearch(input: string): FriendSearch | null {
  const value = normalizeProfileSearchInput(input)
  if (!value) return null

  if (value.includes('@')) {
    return { field: 'email', value }
  }

  return { field: 'uid', value: value.toUpperCase() }
}
