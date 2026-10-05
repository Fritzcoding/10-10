import { useState } from 'react'
import { createMemoryGame, flipMemoryCard, getRockPaperScissorsOutcome, submitWordChainWord, type MemoryGameState, type RockPaperScissorsChoice } from '../../lib/tinyGames'
import type { GameId } from '../../lib/gameCatalog'
import './TinyGame.css'

type TinyGameId = Extract<GameId, 'memory-match' | 'rock-paper-scissors' | 'word-chain'>
type TinyGameProps = { gameId: TinyGameId }
const SYMBOLS = ['🌙', '🌷', '☀️', '🍓', '🌈', '🐚', '🍋', '🦋']
const CHOICES: RockPaperScissorsChoice[] = ['rock', 'paper', 'scissors']

function TinyGame({ gameId }: TinyGameProps) {
  const [memory, setMemory] = useState<MemoryGameState>(() => createMemoryGame(SYMBOLS))
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

  const flip = (index: number) => {
    const next = flipMemoryCard(memory, index)
    if (next === memory) return
    const pendingCards = memory.revealed.filter((cardIndex) => !memory.matched.includes(cardIndex))
    if (next.matched.length > memory.matched.length) setScores((current) => current.map((score, index) => index === player ? score + 1 : score))
    else if (pendingCards.length === 1) setPlayer((current) => 1 - current)
    setMemory(next)
  }

  const restartMemory = () => { setMemory(createMemoryGame(SYMBOLS)); setScores([0, 0]); setPlayer(0) }
  const restartRps = () => setRps({})
  const submitWord = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = submitWordChainWord(words, word)
    if (!next) { setWordError(words.length ? `Use a new word that starts with “${words.at(-1)?.slice(-1)}”.` : 'Enter a word to start the chain.'); return }
    setWords(next)
    setWord('')
    setWordError('')
    setPlayer((current) => 1 - current)
  }

  return <section className="tiny-game" aria-label={gameId.replaceAll('-', ' ')}>
    <header className="tiny-game__header">
      <div><p className="hub-panel__eyebrow">A little game for two</p><h2>{gameId === 'memory-match' ? 'Memory Match' : gameId === 'rock-paper-scissors' ? 'Rock, Paper, Scissors' : 'Word Chain'}</h2></div>
      {gameId === 'memory-match' && <button className="tiny-game__quiet-button" type="button" onClick={restartMemory}>Start over</button>}
      {gameId === 'rock-paper-scissors' && rpsWinner && <button className="tiny-game__quiet-button" type="button" onClick={restartRps}>Play again</button>}
      {gameId === 'word-chain' && words.length > 0 && <button className="tiny-game__quiet-button" type="button" onClick={() => { setWords([]); setPlayer(0); setWordError('') }}>Start over</button>}
    </header>

    {gameId === 'memory-match' && <>
      <p className="tiny-game__status" aria-live="polite">{memoryWinner ?? `Player ${player + 1} · ${pairsFound} of ${SYMBOLS.length} pairs`}</p>
      <div className="memory-board" aria-label="Memory cards">
        {memory.cards.map((card, index) => {
          const shown = memory.revealed.includes(index)
          return <button className={`memory-card${shown ? ' memory-card--shown' : ''}`} key={card.id} type="button" aria-label={shown ? `Card ${index + 1}: ${card.pair}` : `Reveal card ${index + 1}`} aria-pressed={shown} disabled={Boolean(memoryWinner) || memory.matched.includes(index)} onClick={() => flip(index)}>{shown ? card.pair : '·'}</button>
        })}
      </div>
      <p className="tiny-game__scores">Player 1: {scores[0]} pairs <span>Player 2: {scores[1]} pairs</span></p>
    </>}

    {gameId === 'rock-paper-scissors' && <>
      <p className="tiny-game__status" aria-live="polite">{rpsWinner ? rpsWinner === 'tie' ? 'It’s a tie!' : `Player ${rpsWinner === 'player-1' ? '1' : '2'} wins!` : rps.first ? 'Pass the phone to Player 2 for their pick.' : 'Player 1, make a pick.'}</p>
      {rpsWinner && <p className="rps-reveal">{rps.first} <span>·</span> {rps.second}</p>}
      {!rpsWinner && <div className="rps-choices" aria-label={rps.first ? 'Player 2 choices' : 'Player 1 choices'}>
        {CHOICES.map((choice) => <button type="button" key={choice} onClick={() => setRps((current) => current.first ? { ...current, second: choice } : { first: choice })}>{choice}</button>)}
      </div>}
    </>}

    {gameId === 'word-chain' && <>
      <p className="tiny-game__status" aria-live="polite">{words.length >= 10 ? 'Ten words! You made the chain together.' : `Player ${player + 1} · ${words.length} of 10 words`}</p>
      <div className="word-chain" aria-live="polite">{words.map((entry, index) => <span className="word-chain__word" key={`${entry}-${index}`}>{entry}</span>)}</div>
      {words.length < 10 && <form className="word-chain__form" onSubmit={submitWord}>
        <label htmlFor="word-chain-input">{words.length ? `Word starting with “${words.at(-1)?.slice(-1)}”` : 'Start with any word'}</label>
        <div><input id="word-chain-input" value={word} onChange={(event) => setWord(event.target.value)} autoComplete="off" /><button type="submit">Add word</button></div>
        {wordError && <p className="tiny-game__error" role="alert">{wordError}</p>}
      </form>}
    </>}
  </section>
}

export default TinyGame
