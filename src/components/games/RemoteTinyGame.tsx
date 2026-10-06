import { useEffect, useState } from 'react'
import type { GameSession } from '../../lib/gameSessions'
import { getRockPaperScissorsOutcome, type RockPaperScissorsChoice } from '../../lib/tinyGames'
import { getTinyGameState, mergeTinyGameState, submitTinyGameAction, submitTinyGameRpsChoice, type TinyGameAction, type TinyGameEnvelope } from '../../lib/tinyGameSessions'
import { supabase } from '../../lib/supabase'
import './TinyGame.css'

const choices: RockPaperScissorsChoice[] = ['rock', 'paper', 'scissors']

export default function RemoteTinyGame({ session, userId }: { session: GameSession; userId: string }) {
  const [current, setCurrent] = useState<TinyGameEnvelope | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const mark = session.player_x_id === userId ? 'X' : 'O'

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    const refresh = async () => {
      try {
        const incoming = await getTinyGameState(session.id)
        if (active) setCurrent((previous) => previous ? mergeTinyGameState(previous, incoming) : incoming)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'The shared game could not be loaded.')
      }
    }
    const channel = client.channel(`tiny-game-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiny_game_states', filter: `session_id=eq.${session.id}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiny_game_choices', filter: `session_id=eq.${session.id}` }, () => void refresh())
      .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh() })
    window.addEventListener('focus', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh); void client.removeChannel(channel) }
  }, [session.id])

  const submitAction = async (action: TinyGameAction): Promise<boolean> => {
    if (!current || saving) return false
    setSaving(true)
    setError('')
    try {
      const incoming = await submitTinyGameAction(current.session.id, current.session.revision, action)
      setCurrent((previous) => previous ? mergeTinyGameState(previous, incoming) : incoming)
      return true
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes('stale_revision')
        ? 'The board changed. It is refreshed; please try again.'
        : cause instanceof Error ? cause.message : 'Your move could not be saved.')
      try {
        const latest = await getTinyGameState(session.id)
        setCurrent((previous) => previous ? mergeTinyGameState(previous, latest) : latest)
      } catch { /* Keep the last visible board. */ }
      return false
    } finally { setSaving(false) }
  }

  const submitChoice = async (choice: RockPaperScissorsChoice) => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const incoming = await submitTinyGameRpsChoice(session.id, choice)
      setCurrent((previous) => previous ? mergeTinyGameState(previous, incoming) : incoming)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your choice could not be saved.')
    } finally { setSaving(false) }
  }

  if (!current) return <section className="tiny-game" aria-live="polite"><p>Loading your shared game…</p>{error && <p className="tiny-game__error" role="alert">{error}</p>}</section>
  const game = current.state
  const isMyTurn = current.session.turn === mark
  const title = game.game_type === 'memory-match' ? 'Memory Match' : game.game_type === 'word-chain' ? 'Word Chain' : 'Rock, Paper, Scissors'
  const rpsFirst = current.choices.find(({ user_id }) => user_id === current.session.player_x_id)?.choice
  const rpsSecond = current.choices.find(({ user_id }) => user_id === current.session.player_o_id)?.choice
  const rpsOutcome = rpsFirst && rpsSecond ? getRockPaperScissorsOutcome(rpsFirst, rpsSecond) : null

  return <section className="tiny-game" aria-label={title}>
    <header className="tiny-game__header"><div><p className="hub-panel__eyebrow">Playing with a friend</p><h2>{title}</h2></div></header>
    {game.game_type === 'memory-match' && <>
      <p className="tiny-game__status" aria-live="polite">{current.session.status === 'completed' ? 'All pairs found!' : `${isMyTurn ? 'Your turn' : 'Waiting for your friend'} · ${game.matched.length / 2} of ${game.cards.length / 2} pairs`}</p>
      <div className="memory-board" aria-label="Memory cards">
        {game.cards.map(({ id, pair }, index) => {
          const shown = pair !== null
          return <button className={`memory-card${shown ? ' memory-card--shown' : ''}`} key={id} type="button"
            aria-label={shown ? `Card ${index + 1}: ${pair}` : `Reveal card ${index + 1}`}
            aria-pressed={shown} disabled={saving || current.session.status !== 'active' || !isMyTurn || game.revealed.includes(index) || game.matched.includes(index)}
            onClick={() => void submitAction({ type: 'flip', index })}>{shown ? pair : '·'}</button>
        })}
      </div>
      <p className="tiny-game__scores">You: {game.scores[mark === 'X' ? 0 : 1]} pairs <span>Your friend: {game.scores[mark === 'X' ? 1 : 0]} pairs</span></p>
    </>}
    {game.game_type === 'word-chain' && <>
      <p className="tiny-game__status" aria-live="polite">{current.session.status === 'completed' ? 'Ten words! You made the chain together.' : isMyTurn ? `${game.words.length ? `Start with “${game.words.at(-1)?.slice(-1)}”` : 'Start with any word'} · your turn` : 'Waiting for your friend'}</p>
      <div className="word-chain" aria-live="polite">{game.words.map((word, index) => <span className="word-chain__word" key={`${word}-${index}`}>{word}</span>)}</div>
      {game.words.length < 10 && <form className="word-chain__form" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem('word') as HTMLInputElement; void submitAction({ type: 'word', word: input.value }).then((saved) => { if (saved) input.value = '' }) }}>
        <label htmlFor={`word-chain-${session.id}`}>{game.words.length ? `Word starting with “${game.words.at(-1)?.slice(-1)}”` : 'Start with any word'}</label>
        <div><input id={`word-chain-${session.id}`} name="word" autoComplete="off" disabled={!isMyTurn || saving || current.session.status !== 'active'} /><button type="submit" disabled={!isMyTurn || saving || current.session.status !== 'active'}>Add word</button></div>
      </form>}
    </>}
    {game.game_type === 'rock-paper-scissors' && <>
      <p className="tiny-game__status" aria-live="polite">{rpsOutcome ? rpsOutcome === 'tie' ? 'It’s a tie!' : `${rpsOutcome === (mark === 'X' ? 'player-1' : 'player-2') ? 'You win!' : 'Your friend wins!'}` : current.choices.length ? 'Your pick is hidden. Waiting for your friend…' : 'Choose your move. It stays hidden until both of you pick.'}</p>
      {rpsOutcome && <p className="rps-reveal">{rpsFirst} <span>·</span> {rpsSecond}</p>}
      {!rpsOutcome && !current.choices.some(({ user_id }) => user_id === userId) && <div className="rps-choices" aria-label="Choose rock, paper, or scissors">{choices.map((choice) => <button type="button" key={choice} disabled={saving} onClick={() => void submitChoice(choice)}>{choice}</button>)}</div>}
    </>}
    {error && <p className="tiny-game__error" role="alert">{error}</p>}
  </section>
}
