import test from 'node:test'
import assert from 'node:assert/strict'
import * as tinyGameRules from '../src/lib/tinyGames.ts'
import {
  createMemoryGame,
  flipMemoryCard,
  getRockPaperScissorsOutcome,
  submitWordChainWord,
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

test('memory bot uses a known pair before choosing randomly', () => {
  assert.equal(typeof tinyGameRules.chooseMemoryBotFlip, 'function')
  if (typeof tinyGameRules.chooseMemoryBotFlip !== 'function') return
  const game = { cards: [{ id: 0, pair: 'a' }, { id: 1, pair: 'a' }, { id: 2, pair: 'b' }], revealed: [], matched: [] }
  assert.equal(tinyGameRules.chooseMemoryBotFlip(game, new Map([[0, 'a'], [1, 'a']]), () => 0.99), 0)
})

test('memory bot does not inspect unseen card pairs', () => {
  assert.equal(typeof tinyGameRules.chooseMemoryBotFlip, 'function')
  if (typeof tinyGameRules.chooseMemoryBotFlip !== 'function') return
  const game = { cards: [{ id: 0, pair: 'a' }, { id: 1, pair: 'a' }, { id: 2, pair: 'b' }], revealed: [], matched: [] }
  assert.equal(tinyGameRules.chooseMemoryBotFlip(game, new Map([[0, 'a']]), () => 0.99), 2)
})

test('memory bot never selects a matched card', () => {
  assert.equal(typeof tinyGameRules.chooseMemoryBotFlip, 'function')
  if (typeof tinyGameRules.chooseMemoryBotFlip !== 'function') return
  const game = { cards: [{ id: 0, pair: 'a' }, { id: 1, pair: 'a' }, { id: 2, pair: 'b' }], revealed: [], matched: [0, 1] }
  assert.equal(tinyGameRules.chooseMemoryBotFlip(game, new Map(), () => 0), 2)
})

test('word chain bot returns an unused legal word', () => {
  assert.equal(typeof tinyGameRules.chooseWordChainBotWord, 'function')
  if (typeof tinyGameRules.chooseWordChainBotWord !== 'function') return
  const word = tinyGameRules.chooseWordChainBotWord(['cloud'], () => 0)
  assert.ok(word)
  assert.equal(submitWordChainWord(['cloud'], word)?.at(-1), word)
})

test('word chain bot returns null when no legal word exists', () => {
  assert.equal(typeof tinyGameRules.chooseWordChainBotWord, 'function')
  if (typeof tinyGameRules.chooseWordChainBotWord !== 'function') return
  assert.equal(tinyGameRules.chooseWordChainBotWord(['cloud', 'dawn', 'night', 'tree', 'earth', 'home', 'eagle', 'egg', 'garden', 'nest']), null)
})
