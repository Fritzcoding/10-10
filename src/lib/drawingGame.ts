export const DRAWING_DURATION_PRESETS = [15, 30, 60, 180, 300] as const
export const MAX_DRAWING_SECONDS = 600
export const MAX_DRAWING_IMAGE_BYTES = 5 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateDrawingDuration(seconds: number): number {
  if (!Number.isInteger(seconds)) throw new Error('Drawing duration must be a whole number of seconds')
  if (seconds < 15 || seconds > MAX_DRAWING_SECONDS) throw new Error('Drawing duration must be between 15 and 600 seconds')
  return seconds
}

export function canRevealDrawing(submissionCount: number, deadline: Date, now: Date): boolean {
  return submissionCount >= 2 || now.getTime() >= deadline.getTime()
}

export function validateDrawingImage(mimeType: string, size: number): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) && Number.isInteger(size) && size > 0 && size <= MAX_DRAWING_IMAGE_BYTES
}

export function drawingObjectPath(sessionId: string, type: 'reference' | 'drawing', mimeType: string, userId?: string): string {
  if (!UUID.test(sessionId)) throw new Error('Drawing session id is invalid')
  if (type === 'drawing') {
    if (mimeType !== 'image/png') throw new Error('Canvas drawings must be PNG images')
    if (!userId || !UUID.test(userId)) throw new Error('Drawing user id is invalid')
    return `${sessionId}/drawings/${userId}.png`
  }
  const extension = ({ 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' } as const)[mimeType as 'image/jpeg' | 'image/png' | 'image/webp']
  if (!extension) throw new Error('Reference image type is not allowed')
  return `${sessionId}/reference.${extension}`
}
