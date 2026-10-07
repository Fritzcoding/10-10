const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function validatePhotoMemory(file: Pick<File, 'type' | 'size'>, caption: string, date: string) {
  if (!PHOTO_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.')
  if (file.size < 1) throw new Error('The selected photo is empty.')
  if (file.size > MAX_PHOTO_BYTES) throw new Error('Choose a photo no larger than 5 MiB.')
  const cleanCaption = caption.trim()
  if (cleanCaption.length > 500) throw new Error('Caption must be 500 characters or fewer.')
  if (!isValidDate(date)) throw new Error('Enter a valid photo date.')
  return { caption: cleanCaption, date }
}

export function onThisDayMemories<T extends { date: string }>(rows: T[], today: string) {
  const monthDay = today.slice(5)
  return rows.filter((row) => row.date < today && row.date.slice(5) === monthDay)
}
