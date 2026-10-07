export type Milestone = { id: string; title: string; date: string; annual: boolean; category?: string; featured?: boolean }

const parseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter a valid date.')
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error('Enter a valid date.')
  return date
}

export function validateMilestone(title: string, date: string, annual: boolean) {
  const cleanTitle = title.trim()
  if (!cleanTitle || cleanTitle.length > 120) throw new Error('Title must be 1 to 120 characters.')
  parseDate(date)
  return { title: cleanTitle, date, annual }
}

export function getMilestoneOccurrence(milestone: Pick<Milestone, 'date' | 'annual'>, today: string) {
  parseDate(today)
  if (!milestone.annual) return milestone.date
  const monthDay = milestone.date.slice(5)
  const candidateForYear = (year: number) => monthDay === '02-29' && new Date(Date.UTC(year, 1, 29)).getUTCDate() !== 29
    ? `${year}-02-28`
    : `${year}-${monthDay}`
  let occurrence = candidateForYear(Number(today.slice(0, 4)))
  if (occurrence < today) occurrence = candidateForYear(Number(today.slice(0, 4)) + 1)
  return occurrence
}

export function getDaysUntilMilestone(occurrence: string, today: string) {
  return Math.round((parseDate(occurrence).valueOf() - parseDate(today).valueOf()) / 86_400_000)
}

export function upcomingMilestones<T extends Milestone>(milestones: T[], today: string) {
  return milestones.map((milestone) => {
    const occurrence = getMilestoneOccurrence(milestone, today)
    return { ...milestone, occurrence, daysUntil: getDaysUntilMilestone(occurrence, today) }
  }).filter((milestone) => milestone.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title))
}
