export type FriendSearch = {
  field: 'email' | 'uid'
  value: string
}

export function normalizeFriendSearch(input: string): FriendSearch | null {
  const value = input.trim()
  if (!value) return null

  if (value.includes('@')) {
    return { field: 'email', value: value.toLowerCase() }
  }

  return { field: 'uid', value: value.toUpperCase() }
}
