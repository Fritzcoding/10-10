export const SURPRISE_TYPES = ['note', 'question', 'photo', 'challenge', 'activity'] as const
export type SurpriseType = typeof SURPRISE_TYPES[number]

export type ScheduledSurpriseInput = {
  type: SurpriseType
  payload: { text: string }
  releaseAt: string
}

export function validateScheduledSurprise(
  type: string,
  text: string,
  releaseAt: Date,
  now = new Date(),
  photo?: Pick<File, 'type' | 'size'>,
): ScheduledSurpriseInput {
  if (!SURPRISE_TYPES.includes(type as SurpriseType)) throw new Error('Choose a supported surprise type.')
  if (!Number.isFinite(releaseAt.getTime()) || releaseAt.getTime() <= now.getTime()) throw new Error('Choose a release time in the future.')
  const cleanText = text.trim()
  if (type === 'photo') {
    if (!photo || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 8 * 1024 * 1024) {
      throw new Error('Choose a JPEG, PNG, or WebP photo up to 8 MB.')
    }
    if (cleanText.length > 500) throw new Error('Keep the photo caption under 500 characters.')
  } else if (!cleanText || cleanText.length > 2000) {
    throw new Error('Surprise text must be between 1 and 2000 characters.')
  }
  return { type: type as SurpriseType, payload: { text: cleanText }, releaseAt: releaseAt.toISOString() }
}

export const US_SECTION_LINKS = [
  { id: 'us-daily-question', label: 'Question' },
  { id: 'us-dates', label: 'Dates' },
  { id: 'us-calendar', label: 'Calendar' },
  { id: 'us-photos', label: 'Photos' },
  { id: 'us-notes', label: 'Notes' },
  { id: 'us-surprises', label: 'Surprises' },
  { id: 'us-moods', label: 'Moods' },
  { id: 'us-location', label: 'Location' },
  { id: 'us-board', label: 'Board' },
  { id: 'us-wishlists', label: 'Wishlists' },
  { id: 'us-jokes', label: 'Jokes' },
  { id: 'us-timeline', label: 'Timeline' },
] as const
