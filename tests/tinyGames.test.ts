import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMemoryGame,
  flipMemoryCard,
  getRockPaperScissorsOutcome,
  submitWordChainWord,
  recommendGames,
  readGameHistory,
} from '../src/lib/tinyGames.ts'

test('memory match flips valid cards, tracks a pair and ignores duplicate selections', () => {
  const game = createMemoryGame(['🌙', '🌷'])
  const first = 0
  const matchIndex = game.cards.findIndex((card, index) => index !== first && card.pair === game.cards[first].pair)
  const one = flipMemoryCard(game, first)
  const duplicate = flipMemoryCard(one, first)
  const match = flipMemoryCard(duplicate, matchIndex)

  assert.equal(one.revealed.length, 1)
  assert.deepEqual(duplicate, one)
  assert.deepEqual(match.matched, [first, matchIndex])
})

test('memory match keeps found pairs visible while revealing the next card', () => {
  const game = createMemoryGame(['🌙', '🌷'])
  const first = 0
  const matchIndex = game.cards.findIndex((card, index) => index !== first && card.pair === game.cards[first].pair)
  const third = game.cards.findIndex((_, index) => index !== first && index !== matchIndex)
  const match = flipMemoryCard(flipMemoryCard(game, first), matchIndex)

  assert.deepEqual(flipMemoryCard(match, third).revealed, [first, matchIndex, third])
})

test('memory match clears a miss on the next selection', () => {
  const game = createMemoryGame(['🌙', '🌷'])
  const first = 0
  const otherPair = game.cards.findIndex((card) => card.pair !== game.cards[first].pair)
  const unmatched = [first, otherPair]
  const nextPair = game.cards.findIndex((_, index) => !unmatched.includes(index))
  const miss = flipMemoryCard(flipMemoryCard(game, first), otherPair)

  assert.deepEqual(miss.revealed, [first, otherPair])
  assert.deepEqual(flipMemoryCard(miss, nextPair).revealed, [nextPair])
})

test('rock paper scissors reports ties and both winning directions', () => {
  assert.equal(getRockPaperScissorsOutcome('rock', 'rock'), 'tie')
  assert.equal(getRockPaperScissorsOutcome('rock', 'scissors'), 'player-1')
  assert.equal(getRockPaperScissorsOutcome('paper', 'scissors'), 'player-2')
})

test('word chain trims words and rejects a wrong first letter or duplicate', () => {
  const first = submitWordChainWord([], '  Cloud  ')
  assert.deepEqual(first, ['cloud'])
  assert.deepEqual(submitWordChainWord(first, 'Dawn'), ['cloud', 'dawn'])
  assert.equal(submitWordChainWord(first, 'river'), null)
  assert.equal(submitWordChainWord(['cloud', 'dawn'], 'CLOUD'), null)
})

const games = [
  { id: 'local', label: 'Local', durationMinutes: 5, availability: 'local' as const },
  { id: 'partner', label: 'Partner', durationMinutes: 5, availability: 'partner' as const },
  { id: 'long', label: 'Long', durationMinutes: 10, availability: 'local' as const },
]

test('recommendations fit the time window and require an online partner when needed', () => {
  const offline = recommendGames(games, { availableMinutes: 5, partnerOnline: false, recent: {} })
  assert.deepEqual(offline.map(({ id }) => id), ['local'])
  assert.match(offline[0].reason, /5-minute/)

  const online = recommendGames(games, { availableMinutes: 5, partnerOnline: true, recent: {} })
  assert.deepEqual(online.map(({ id }) => id), ['partner', 'local'])
  assert.match(online[0].reason, /partner is online/i)
})

test('recommendations skip recently played games when another fit is available', () => {
  const picks = recommendGames(games, {
    availableMinutes: 5,
    partnerOnline: true,
    recent: { partner: Date.now() },
  })
  assert.equal(picks.some(({ id }) => id === 'partner'), false)
  assert.equal(picks.some(({ id }) => id === 'local'), true)
})

test('recommendations reuse recent games when no fresh game fits', () => {
  const picks = recommendGames([games[0]], {
    availableMinutes: 5,
    partnerOnline: false,
    recent: { local: Date.now() },
  })
  assert.deepEqual(picks.map(({ id }) => id), ['local'])
  assert.match(picks[0].reason, /only fit/i)
})

test('recommendations return no result when nothing fits the time or availability', () => {
  assert.deepEqual(recommendGames(games, { availableMinutes: 1, partnerOnline: false, recent: {} }), [])
  assert.deepEqual(recommendGames([games[1]], { availableMinutes: 5, partnerOnline: false, recent: {} }), [])
})

test('local history safely ignores malformed values and retains valid timestamps', () => {
  assert.deepEqual(readGameHistory('{bad json'), {})
  assert.deepEqual(readGameHistory('{"local":123,"bad":"yesterday","negative":-1}'), { local: 123 })
})
