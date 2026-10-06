export type GameId = 'tic-tac-toe' | 'would-you-rather' | 'question-cards' | 'whos-more-likely' | 'lie-detector' | 'describe-without-saying-it' | 'memory-match' | 'rock-paper-scissors' | 'word-chain' | 'draw-together'
export type GameKind = 'turn-based' | 'hidden-answer' | 'role-based' | 'timed-role-based' | 'drawing'
export type GameAvailability = 'local' | 'partner' | 'either'
export type RoadmapStageId = 'conversation-games' | 'tiny-games' | 'shared-relationship-layer' | 'drawing-and-images' | 'surprise-delivery'

export const GAME_CATALOG = [
  { id: 'tic-tac-toe', label: 'Tic-Tac-Toe', description: 'Classic three-in-a-row', durationMinutes: 5, kind: 'turn-based', availability: 'either' },
  { id: 'would-you-rather', label: 'Would You Rather?', description: 'Pick a side and reveal together', durationMinutes: 5, kind: 'hidden-answer', availability: 'partner' },
  { id: 'question-cards', label: 'Question Cards', description: 'Share a little more about yourselves', durationMinutes: 10, kind: 'hidden-answer', availability: 'partner' },
  { id: 'whos-more-likely', label: 'Who’s More Likely', description: 'Make your pick, then compare', durationMinutes: 5, kind: 'hidden-answer', availability: 'partner' },
  { id: 'lie-detector', label: 'Lie Detector', description: 'Two truths and a lie', durationMinutes: 10, kind: 'role-based', availability: 'partner' },
  { id: 'describe-without-saying-it', label: 'Describe Without Saying It', description: 'Give clues before the timer runs out', durationMinutes: 5, kind: 'timed-role-based', availability: 'partner' },
  { id: 'memory-match', label: 'Memory Match', description: 'Find the matching pairs together', durationMinutes: 5, kind: 'turn-based', availability: 'either' },
  { id: 'rock-paper-scissors', label: 'Rock, Paper, Scissors', description: 'Make a pick, then reveal together', durationMinutes: 2, kind: 'hidden-answer', availability: 'either' },
  { id: 'word-chain', label: 'Word Chain', description: 'Keep the last letter going', durationMinutes: 5, kind: 'turn-based', availability: 'either' },
  { id: 'draw-together', label: 'Draw Together', description: 'Draw from the same prompt, then reveal', durationMinutes: 5, kind: 'drawing', availability: 'partner' },
] as const satisfies readonly { id: GameId; label: string; description: string; durationMinutes: number; kind: GameKind; availability: GameAvailability }[]

export const ROADMAP_STAGE_CATALOG = [
  { stage: 4, id: 'conversation-games', title: 'First conversation games', status: 'active' },
  { stage: 5, id: 'tiny-games', title: 'Tiny games and play modes', status: 'planned' },
  { stage: 6, id: 'shared-relationship-layer', title: 'Shared relationship layer', status: 'planned' },
  { stage: 7, id: 'drawing-and-images', title: 'Drawing and images', status: 'planned' },
  { stage: 8, id: 'surprise-delivery', title: 'Surprise delivery', status: 'planned' },
] as const satisfies readonly { stage: number; id: RoadmapStageId; title: string; status: 'active' | 'planned' }[]
