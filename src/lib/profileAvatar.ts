export const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function isValidAvatarFile(file: Pick<File, 'type' | 'size'>): boolean {
  return AVATAR_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_AVATAR_BYTES
}

export function profileAvatarPath(userId: string): string {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(userId)) throw new Error('A valid user ID is required for an avatar path.')
  return `${userId}/avatar`
}

export function isRemoteAvatarUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
