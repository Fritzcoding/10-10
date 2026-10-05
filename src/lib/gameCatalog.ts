export type GameId = 'tic-tac-toe' | 'would-you-rather' | 'question-cards' | 'whos-more-likely' | 'lie-detector' | 'describe-without-saying-it'
export type GameKind = 'turn-based' | 'hidden-answer' | 'role-based' | 'timed-role-based'
export type RoadmapStageId = 'conversation-games' | 'tiny-games' | 'shared-relationship-layer' | 'drawing-and-images' | 'surprise-delivery'

export const GAME_CATALOG = [
  { id: 'tic-tac-toe', label: 'Tic-Tac-Toe', description: 'Classic three-in-a-row', durationMinutes: 5, kind: 'turn-based' },
  { id: 'would-you-rather', label: 'Would You Rather?', description: 'Pick a side and reveal together', durationMinutes: 5, kind: 'hidden-answer' },
  { id: 'question-cards', label: 'Question Cards', description: 'Share a little more about yourselves', durationMinutes: 10, kind: 'hidden-answer' },
  { id: 'whos-more-likely', label: 'Who’s More Likely', description: 'Make your pick, then compare', durationMinutes: 5, kind: 'hidden-answer' },
  { id: 'lie-detector', label: 'Lie Detector', description: 'Two truths and a lie', durationMinutes: 10, kind: 'role-based' },
  { id: 'describe-without-saying-it', label: 'Describe Without Saying It', description: 'Give clues before the timer runs out', durationMinutes: 5, kind: 'timed-role-based' },
] as const satisfies readonly { id: GameId; label: string; description: string; durationMinutes: number; kind: GameKind }[]

export const ROADMAP_STAGE_CATALOG = [
  { stage: 4, id: 'conversation-games', title: 'First conversation games', status: 'active' },
  { stage: 5, id: 'tiny-games', title: 'Tiny games and Bored Mode', status: 'planned' },
  { stage: 6, id: 'shared-relationship-layer', title: 'Shared relationship layer', status: 'planned' },
  { stage: 7, id: 'drawing-and-images', title: 'Drawing and images', status: 'planned' },
  { stage: 8, id: 'surprise-delivery', title: 'Surprise delivery', status: 'planned' },
] as const satisfies readonly { stage: number; id: RoadmapStageId; title: string; status: 'active' | 'planned' }[]
