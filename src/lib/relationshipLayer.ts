export const DAILY_QUESTIONS = [
  'What little moment from today would you like to remember?',
  'When did you feel most at ease with me recently?',
  'What is one kind thing I did that stayed with you?',
  'What ordinary thing would be more fun if we did it together?',
  'What is a place you would like us to visit again?',
  'What new thing would you enjoy learning side by side?',
  'What does a comforting evening together look like to you?',
  'What are you looking forward to this month?',
  'What small tradition should we keep making time for?',
  'What is something about us that makes you smile?',
  'What would make tomorrow feel a little easier?',
  'What meal would you like to make together?',
  'Which song brings back a happy memory of us?',
  'What would you like more of in our everyday life?',
  'What is a little thing you appreciate about our home?',
  'What would your ideal slow weekend together include?',
  'What is something you have changed your mind about lately?',
  'What is one way we make a good team?',
  'What would you like to celebrate soon?',
  'What is a tiny adventure we could take this week?',
] as const

export function getCoupleLocalDate(date: Date, timezone: string): string {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find((value) => value.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function dailyQuestionForDate(prompts: readonly string[], coupleId: string, date: string): string {
  if (prompts.length === 0) throw new Error('At least one daily question is required')
  const day = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(day) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Daily question date is invalid')
  let coupleHash = 2166136261
  for (const char of coupleId) coupleHash = Math.imul(coupleHash ^ char.charCodeAt(0), 16777619)
  const ordinal = Math.floor(day / 86_400_000)
  const index = ((coupleHash >>> 0) + ordinal) % prompts.length
  return prompts[index]
}

export function validateDailyAnswer(value: string): string {
  const answer = value.trim()
  if (answer.length === 0 || answer.length > 1000) throw new Error('Answer must contain 1 to 1000 characters')
  return answer
}

export function canRevealDailyAnswers(answerCount: number): boolean {
  return answerCount >= 2
}

export function completeBucketItem<T extends { completed: boolean }>(item: T): T {
  return { ...item, completed: !item.completed }
}

export type TimelineEvent = { id: string; pinned: boolean; hidden: boolean; created_at: string }

export function visibleTimelineEvents<T extends TimelineEvent>(events: readonly T[]): T[] {
  return events.filter(({ hidden }) => !hidden).toSorted((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at))
}
