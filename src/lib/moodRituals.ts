export const MOOD_OPTIONS = ['happy', 'loved', 'calm', 'okay', 'low', 'stressed', 'tired', 'excited'] as const
export type Mood = typeof MOOD_OPTIONS[number]
export type Participation = 'either' | 'both'

export function validateMoodCheckin(mood: string, note: string) {
  if (!MOOD_OPTIONS.includes(mood as Mood)) throw new Error('Choose one of the available moods.')
  const cleanNote = note.trim()
  if (cleanNote.length > 500) throw new Error('Keep the note under 500 characters.')
  return { mood: mood as Mood, note: cleanNote }
}

export function validateCoupleRitual(title: string, prompt: string, participation: string, remindersEnabled: boolean) {
  const cleanTitle = title.trim()
  const cleanPrompt = prompt.trim()
  if (!cleanTitle || cleanTitle.length > 100) throw new Error('Use a ritual name between 1 and 100 characters.')
  if (cleanPrompt.length > 500) throw new Error('Keep the prompt under 500 characters.')
  if (participation !== 'either' && participation !== 'both') throw new Error('Choose either-partner or both-partner participation.')
  return { title: cleanTitle, prompt: cleanPrompt, participation: participation as Participation, remindersEnabled }
}

export function ritualWeekStart(localDate: string) {
  const date = new Date(`${localDate}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== localDate) throw new Error('Enter a valid local date.')
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - daysSinceMonday)
  return date.toISOString().slice(0, 10)
}

export function isRitualComplete(participation: Participation, checkedInUserIds: string[], memberUserIds: string[]) {
  if (memberUserIds.length !== 2 || new Set(memberUserIds).size !== 2) throw new Error('A couple ritual requires two distinct members.')
  const checkedIn = new Set(checkedInUserIds.filter((id) => memberUserIds.includes(id)))
  return participation === 'either'
    ? checkedIn.size > 0
    : memberUserIds.every((id) => checkedIn.has(id))
}
