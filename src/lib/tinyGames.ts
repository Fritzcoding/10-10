export type MemoryCard = { id: number; pair: string }
export type MemoryGameState = { cards: MemoryCard[]; revealed: number[]; matched: number[] }
export type RockPaperScissorsChoice = 'rock' | 'paper' | 'scissors'
export type RecommendationGame = { id: string; label: string; durationMinutes: number; availability: 'local' | 'partner' | 'either' }
export type GameRecommendation = RecommendationGame & { reason: string }

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function createMemoryGame(pairs: readonly string[]): MemoryGameState {
  const cards = pairs.flatMap((pair, index) => [{ id: index * 2, pair }, { id: index * 2 + 1, pair }])
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]]
  }
  return { cards, revealed: [], matched: [] }
}

export function flipMemoryCard(game: MemoryGameState, index: number): MemoryGameState {
  if (!Number.isInteger(index) || !game.cards[index] || game.matched.includes(index) || game.revealed.includes(index)) return game
  const pending = game.revealed.filter((cardIndex) => !game.matched.includes(cardIndex))
  const revealed = [...game.matched, ...(pending.length === 1 ? [pending[0]] : []), index]
  const [first, second] = revealed.filter((cardIndex) => !game.matched.includes(cardIndex))
  if (second !== undefined && game.cards[first].pair === game.cards[second].pair) {
    return { ...game, revealed, matched: [...game.matched, first, second] }
  }
  return { ...game, revealed }
}

export function getRockPaperScissorsOutcome(first: RockPaperScissorsChoice, second: RockPaperScissorsChoice): 'player-1' | 'player-2' | 'tie' {
  if (first === second) return 'tie'
  const firstWins = first === 'rock' ? second === 'scissors' : first === 'paper' ? second === 'rock' : second === 'paper'
  return firstWins ? 'player-1' : 'player-2'
}

export function submitWordChainWord(words: readonly string[], input: string): string[] | null {
  const word = input.trim().toLocaleLowerCase()
  if (!word || words.some((previous) => previous.toLocaleLowerCase() === word)) return null
  const previous = words.at(-1)
  if (previous && Array.from(word)[0] !== Array.from(previous.trim())[Array.from(previous.trim()).length - 1]?.toLocaleLowerCase()) return null
  return [...words, word]
}

export function recommendGames<T extends RecommendationGame>(
  catalog: readonly T[],
  options: { availableMinutes: number; partnerOnline: boolean; recent: Readonly<Record<string, number>>; now?: number },
): (T & { reason: string })[] {
  const eligible = catalog.filter((game) => game.durationMinutes <= options.availableMinutes && (game.availability !== 'partner' || options.partnerOnline))
  const now = options.now ?? Date.now()
  const fresh = eligible.filter((game) => !isRecentlyPlayed(options.recent[game.id], now))
  const candidates = fresh.length > 0 ? fresh : eligible
  return [...candidates]
    .sort((a, b) => Number(b.availability === 'partner' && options.partnerOnline) - Number(a.availability === 'partner' && options.partnerOnline) || a.durationMinutes - b.durationMinutes || a.label.localeCompare(b.label))
    .slice(0, 3)
    .map((game) => {
      const onlyRecentFit = fresh.length === 0 && candidates.length === 1
      const reason = onlyRecentFit
        ? `This is the only fit for your ${options.availableMinutes}-minute window, even though you played it recently.`
        : game.availability === 'partner' && options.partnerOnline
          ? `Your partner is online and this fits your ${options.availableMinutes}-minute window.`
          : `Fits your ${options.availableMinutes}-minute window${isRecentlyPlayed(options.recent[game.id], now) ? '; other fitting games were played recently.' : ' and has not been played recently.'}`
      return { ...game, reason }
    })
}

export function readGameHistory(value: string | null): Record<string, number> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] >= 0,
    ))
  } catch {
    return {}
  }
}

function isRecentlyPlayed(timestamp: number | undefined, now: number): boolean {
  return typeof timestamp === 'number' && timestamp <= now && now - timestamp < RECENT_WINDOW_MS
}
