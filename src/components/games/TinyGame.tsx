import { useCallback, useEffect, useState } from 'react'
import { chooseMemoryBotFlip, chooseWordChainBotWord, createMemoryGame, flipMemoryCard, getRockPaperScissorsOutcome, submitWordChainWord, type MemoryGameState, type RockPaperScissorsChoice } from '../../lib/tinyGames'
import type { GameId } from '../../lib/gameCatalog'
import './TinyGame.css'

type TinyGameId = Extract<GameId, 'memory-match' | 'rock-paper-scissors' | 'word-chain'>
type TinyGameProps = { gameId: TinyGameId; mode: 'solo' | 'bot' }
const SYMBOLS = ['🌙', '🌷', '☀️', '🍓', '🌈', '🐚', '🍋', '🦋']
const CHOICES: RockPaperScissorsChoice[] = ['rock', 'paper', 'scissors']

function TinyGame({ gameId, mode }: TinyGameProps) {
  const [memory, setMemory] = useState<MemoryGameState>(() => createMemoryGame(SYMBOLS))
  const [seenPairs, setSeenPairs] = useState<Map<number, string>>(() => new Map())
  const [scores, setScores] = useState([0, 0])
  const [player, setPlayer] = useState(0)
  const [rps, setRps] = useState<{ first?: RockPaperScissorsChoice; second?: RockPaperScissorsChoice }>({})
  const [words, setWords] = useState<string[]>([])
  const [word, setWord] = useState('')
  const [wordError, setWordError] = useState('')
  const pairsFound = memory.matched.length / 2
  const memoryWinner = pairsFound === SYMBOLS.length
    ? scores[0] === scores[1] ? 'It’s a draw.' : `Player ${scores[0] > scores[1] ? '1' : '2'} wins!`
    : null
  const rpsWinner = rps.first && rps.second ? getRockPaperScissorsOutcome(rps.first, rps.second) : null

  const flip = useCallback((index: number, actingPlayer = player) => {
    if (mode === 'bot' && player !== actingPlayer) return
    const next = flipMemoryCard(memory, index)
    if (next === memory) return
    const pendingCards = memory.revealed.filter((cardIndex) => !memory.matched.includes(cardIndex))
    if (next.matched.length > memory.matched.length) setScores((current) => current.map((score, index) => index === player ? score + 1 : score))
    else if (pendingCards.length === 1) setPlayer((current) => 1 - current)
    setMemory(next)
    setSeenPairs((current) => {
      const seen = new Map(current)
      for (const cardIndex of [...next.revealed, ...next.matched]) seen.set(cardIndex, next.cards[cardIndex].pair)
      return seen
    })
  }, [memory, mode, player])

  const restartMemory = () => { setMemory(createMemoryGame(SYMBOLS)); setSeenPairs(new Map()); setScores([0, 0]); setPlayer(0) }
  const restartRps = () => setRps({})
  const playWord = useCallback((input: string) => {
    const next = submitWordChainWord(words, input)
    if (!next) { setWordError(words.length ? `Use a new word that starts with “${words.at(-1)?.slice(-1)}”.` : 'Enter a word to start the chain.'); return }
    setWords(next)
    setWord('')
    setWordError('')
    setPlayer((current) => 1 - current)
  }, [words])
  const submitWord = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); playWord(word) }

  useEffect(() => {
    if (mode !== 'bot' || gameId !== 'memory-match' || player !== 1 || memoryWinner) return
    const timer = window.setTimeout(() => {
      const index = chooseMemoryBotFlip(memory, seenPairs)
      if (index !== null) flip(index, 1)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [flip, gameId, memory, memoryWinner, mode, player, seenPairs])

  useEffect(() => {
    if (mode !== 'bot' || gameId !== 'word-chain' || player !== 1 || words.length >= 10) return
    const timer = window.setTimeout(() => {
      const next = chooseWordChainBotWord(words)
      if (next) playWord(next)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [gameId, mode, playWord, player, words])

  useEffect(() => {
    if (mode !== 'bot' || gameId !== 'rock-paper-scissors' || !rps.first || rps.second) return
    const timer = window.setTimeout(() => {
      setRps((current) => current.first && !current.second
        ? { ...current, second: CHOICES[Math.floor(Math.random() * CHOICES.length)] }
        : current)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [gameId, mode, rps])

  return <section className="tiny-game" aria-label={gameId.replaceAll('-', ' ')}>
    <header className="tiny-game__header">
      <div><p className="hub-panel__eyebrow">{mode === 'bot' ? 'Playing against a bot' : 'You control both turns'}</p><h2>{gameId === 'memory-match' ? 'Memory Match' : gameId === 'rock-paper-scissors' ? 'Rock, Paper, Scissors' : 'Word Chain'}</h2></div>
      {gameId === 'memory-match' && <button className="tiny-game__quiet-button" type="button" onClick={restartMemory}>Start over</button>}
      {gameId === 'rock-paper-scissors' && rpsWinner && <button className="tiny-game__quiet-button" type="button" onClick={restartRps}>Play again</button>}
      {gameId === 'word-chain' && words.length > 0 && <button className="tiny-game__quiet-button" type="button" onClick={() => { setWords([]); setPlayer(0); setWordError('') }}>Start over</button>}
    </header>

    {gameId === 'memory-match' && <>
      <p className="tiny-game__status" aria-live="polite">{memoryWinner ?? `Player ${player + 1} · ${pairsFound} of ${SYMBOLS.length} pairs`}</p>
      <div className="memory-board" aria-label="Memory cards">
        {memory.cards.map((card, index) => {
          const shown = memory.revealed.includes(index)
          return <button className={`memory-card${shown ? ' memory-card--shown' : ''}`} key={card.id} type="button" aria-label={shown ? `Card ${index + 1}: ${card.pair}` : `Reveal card ${index + 1}`} aria-pressed={shown} disabled={Boolean(memoryWinner) || memory.matched.includes(index) || (mode === 'bot' && player === 1)} onClick={() => flip(index)}>{shown ? card.pair : '·'}</button>
        })}
      </div>
      <p className="tiny-game__scores">Player 1: {scores[0]} pairs <span>Player 2: {scores[1]} pairs</span></p>
    </>}

    {gameId === 'rock-paper-scissors' && <>
      <p className="tiny-game__status" aria-live="polite">{rpsWinner ? rpsWinner === 'tie' ? 'It’s a tie!' : `Player ${rpsWinner === 'player-1' ? '1' : '2'} wins!` : rps.first ? mode === 'bot' && !rps.second ? 'The bot is choosing…' : 'Player 2, make a pick.' : 'Player 1, make a pick.'}</p>
      {rpsWinner && <p className="rps-reveal">{rps.first} <span>·</span> {rps.second}</p>}
      {!rpsWinner && !(mode === 'bot' && rps.first) && <div className="rps-choices" aria-label={rps.first ? 'Player 2 choices' : 'Player 1 choices'}>
        {CHOICES.map((choice) => <button type="button" key={choice} onClick={() => setRps((current) => current.first ? { ...current, second: choice } : { first: choice })}>{choice}</button>)}
      </div>}
    </>}

    {gameId === 'word-chain' && <>
      <p className="tiny-game__status" aria-live="polite">{words.length >= 10 ? 'Ten words! You made the chain together.' : mode === 'bot' && player === 1 ? 'The bot is thinking…' : `Player ${player + 1} · ${words.length} of 10 words`}</p>
      <div className="word-chain" aria-live="polite">{words.map((entry, index) => <span className="word-chain__word" key={`${entry}-${index}`}>{entry}</span>)}</div>
      {words.length < 10 && !(mode === 'bot' && player === 1) && <form className="word-chain__form" onSubmit={submitWord}>
        <label htmlFor="word-chain-input">{words.length ? `Word starting with “${words.at(-1)?.slice(-1)}”` : 'Start with any word'}</label>
        <div><input id="word-chain-input" value={word} onChange={(event) => setWord(event.target.value)} autoComplete="off" /><button type="submit">Add word</button></div>
        {wordError && <p className="tiny-game__error" role="alert">{wordError}</p>}
      </form>}
    </>}
  </section>
}

export default TinyGame
