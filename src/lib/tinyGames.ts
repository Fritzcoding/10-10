export type MemoryCard = { id: number; pair: string }
export type MemoryGameState = { cards: MemoryCard[]; revealed: number[]; matched: number[] }
export type RockPaperScissorsChoice = 'rock' | 'paper' | 'scissors'
const WORD_CHAIN_BOT_WORDS = ['cloud', 'dawn', 'night', 'tree', 'earth', 'home', 'eagle', 'egg', 'garden', 'nest']

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

export function chooseMemoryBotFlip(game: MemoryGameState, seenPairs: ReadonlyMap<number, string>, random: () => number = Math.random): number | null {
  const available = game.cards.map((_, index) => index).filter((index) => !game.matched.includes(index) && !game.revealed.includes(index))
  const knownByPair = new Map<string, number[]>()
  for (const [index, pair] of seenPairs) {
    if (!available.includes(index)) continue
    knownByPair.set(pair, [...(knownByPair.get(pair) ?? []), index])
  }
  const knownMatch = [...knownByPair.values()].find((indexes) => indexes.length > 1)
  if (knownMatch) return knownMatch[0]
  if (available.length === 0) return null
  return available[Math.min(available.length - 1, Math.floor(random() * available.length))]
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

export function chooseWordChainBotWord(words: readonly string[], random: () => number = Math.random): string | null {
  const used = new Set(words.map((word) => word.toLocaleLowerCase()))
  const previous = words.at(-1)?.trim().toLocaleLowerCase()
  const legal = WORD_CHAIN_BOT_WORDS.filter((word) => !used.has(word) && (!previous || Array.from(word)[0] === Array.from(previous).at(-1)))
  if (legal.length === 0) return null
  return legal[Math.min(legal.length - 1, Math.floor(random() * legal.length))]
}
