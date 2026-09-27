import { ArrowLeft, Gamepad2 } from 'lucide-react'
import { useState } from 'react'
import TicTacToe from './games/TicTacToe'
import './Games.css'

function Games() {
  const [activeGame, setActiveGame] = useState<'tic-tac-toe' | null>(null)

  if (activeGame === 'tic-tac-toe') {
    return (
      <div className="games-view">
        <button className="games-view__back" type="button" onClick={() => setActiveGame(null)}>
          <ArrowLeft size={17} aria-hidden="true" />
          All games
        </button>
        <TicTacToe />
      </div>
    )
  }

  return (
    <div className="games-directory">
      <div className="games-directory__intro">
        <p className="hub-panel__eyebrow">Play together</p>
        <h2>Pick a little game.</h2>
        <p>Choose something quick and make a new memory together.</p>
      </div>
      <div className="games-grid">
        <button className="game-card" type="button" onClick={() => setActiveGame('tic-tac-toe')}>
          <span className="game-card__icon"><Gamepad2 size={24} aria-hidden="true" /></span>
          <span className="game-card__copy">
            <strong>Tic-Tac-Toe</strong>
            <span>Classic three-in-a-row</span>
          </span>
          <span className="game-card__arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )
}

export default Games
