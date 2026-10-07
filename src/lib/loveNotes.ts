const MAX_NOTE_LENGTH = 2000
const MAX_VOICE_BYTES = 5 * 1024 * 1024
const VOICE_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/ogg'])

export function validateLoveNote(text: string) {
  const clean = text.trim()
  if (!clean) throw new Error('A love note needs at least one character.')
  if (clean.length > MAX_NOTE_LENGTH) throw new Error(`Love notes must be ${MAX_NOTE_LENGTH} characters or fewer.`)
  return clean
}

export function validateVoiceMemo(file: Pick<File, 'type' | 'size'>, durationMs: number) {
  if (!VOICE_TYPES.has(file.type)) throw new Error('Choose a supported audio recording.')
  if (file.size < 1) throw new Error('The voice memo is empty.')
  if (file.size > MAX_VOICE_BYTES) throw new Error('Choose a voice memo no larger than 5 MiB.')
  if (!Number.isFinite(durationMs) || durationMs < 1) throw new Error('Recording duration must be greater than zero.')
  if (durationMs > 60_000) throw new Error('Voice memos must be 60 seconds or shorter.')
  return { durationMs: Math.round(durationMs) }
}
