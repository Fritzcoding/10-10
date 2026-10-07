export const BOARD_SIZE = 1000
export const BOARD_COLORS = ['#426f88', '#e5858b', '#f2b66d', '#6f8d68'] as const
export type BoardColor = typeof BOARD_COLORS[number]
export type BoardPoint = { x: number; y: number }

export function validateBoardStroke(points: unknown, color: string, width: number): { points: BoardPoint[]; color: BoardColor; width: number } {
  if (!Array.isArray(points) || points.length < 2 || points.length > 500) throw new Error('A stroke needs 2 to 500 points.')
  if (!BOARD_COLORS.includes(color as BoardColor)) throw new Error('Choose a supported board color.')
  if (!Number.isFinite(width) || width < 2 || width > 20) throw new Error('Stroke width must be between 2 and 20.')
  const valid = points.every((point) => typeof point === 'object' && point !== null
    && Number.isFinite((point as BoardPoint).x) && (point as BoardPoint).x >= 0 && (point as BoardPoint).x <= BOARD_SIZE
    && Number.isFinite((point as BoardPoint).y) && (point as BoardPoint).y >= 0 && (point as BoardPoint).y <= BOARD_SIZE)
  if (!valid) throw new Error('Stroke points must stay inside the board.')
  return { points: points as BoardPoint[], color: color as BoardColor, width }
}

export function normalizePointerPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): BoardPoint {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) throw new Error('Board size is unavailable.')
  return {
    x: Math.max(0, Math.min(BOARD_SIZE, ((clientX - rect.left) / rect.width) * BOARD_SIZE)),
    y: Math.max(0, Math.min(BOARD_SIZE, ((clientY - rect.top) / rect.height) * BOARD_SIZE)),
  }
}

export function moveKeyboardCursor(point: BoardPoint, key: string): BoardPoint {
  const next = { ...point }
  if (key === 'ArrowLeft') next.x = Math.max(0, next.x - 50)
  if (key === 'ArrowRight') next.x = Math.min(BOARD_SIZE, next.x + 50)
  if (key === 'ArrowUp') next.y = Math.max(0, next.y - 50)
  if (key === 'ArrowDown') next.y = Math.min(BOARD_SIZE, next.y + 50)
  return next
}

export function isCurrentBoardGeneration(current: number, expected: number): boolean {
  return Number.isSafeInteger(current) && current > 0 && current === expected
}
