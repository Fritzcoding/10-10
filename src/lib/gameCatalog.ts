export type GameId = 'tic-tac-toe' | 'would-you-rather'

export const GAME_CATALOG = [
  { id: 'tic-tac-toe', label: 'Tic-Tac-Toe', durationMinutes: 5, kind: 'turn-based' },
  { id: 'would-you-rather', label: 'Would You Rather?', durationMinutes: 5, kind: 'hidden-answer' },
] as const satisfies readonly { id: GameId; label: string; durationMinutes: number; kind: 'turn-based' | 'hidden-answer' }[]
