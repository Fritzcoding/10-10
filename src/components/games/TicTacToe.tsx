import { useEffect, useState } from 'react'
import { applyMove, chooseBotMove, createInitialGameState, getGameOutcome, type GameState, type Mark } from '../../lib/ticTacToe'
import './TicTacToe.css'

export type TicTacToeMode = 'bot' | 'solo' | 'remote'
type TicTacToeProps = { mode?: TicTacToeMode; remoteState?: GameState; playerMark?: Mark; onMove?: (index: number) => void }

function TicTacToe({ mode = 'solo', remoteState, playerMark: requestedPlayerMark, onMove }: TicTacToeProps) {
  const [game, setGame] = useState<GameState>(createInitialGameState)
  const displayedGame = mode === 'remote' && remoteState ? remoteState : game
  const { winner, draw: isDraw } = getGameOutcome(displayedGame.board)
  const effectivePlayerMark = requestedPlayerMark ?? 'X'

  useEffect(() => {
    if (mode !== 'bot' || displayedGame.turn !== 'O' || winner || isDraw) return
    const timer = window.setTimeout(() => {
      const move = chooseBotMove(displayedGame)
      if (move !== null) setGame(applyMove(displayedGame, move))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [displayedGame, isDraw, mode, winner])

  const handleCellClick = (index: number) => {
    if (winner || isDraw || (mode !== 'solo' && displayedGame.turn !== effectivePlayerMark) || displayedGame.board[index]) return
    if (mode === 'remote') {
      onMove?.(index)
      return
    }
    setGame(applyMove(displayedGame, index))
  }

  const resetGame = () => setGame(createInitialGameState())

  return (
    <section className="tic-tac-toe" aria-labelledby="tic-tac-toe-title">
      <header className="tic-tac-toe__header">
        <div>
          <p className="hub-panel__eyebrow">A tiny classic</p>
          <h2 id="tic-tac-toe-title">Tic-Tac-Toe</h2>
        </div>
        {mode !== 'remote' && <button className="tic-tac-toe__reset" type="button" onClick={resetGame}>Reset Game</button>}
      </header>
      <div className="tic-tac-toe__status" aria-live="polite">
        {winner ? `${winner} wins!` : isDraw ? 'It’s a draw.' : mode === 'solo' ? `Player ${displayedGame.turn}’s turn · you control both` : `${displayedGame.turn}'s turn`}
        {mode !== 'solo' && <span>You are {effectivePlayerMark}</span>}
      </div>
      <div className="tic-tac-toe__board" role="grid" aria-label="Tic-Tac-Toe board">
        {displayedGame.board.map((cell, index) => (
          <button
            key={index}
            className={`tic-tac-toe__cell tic-tac-toe__cell--${cell?.toLowerCase() ?? 'empty'}`}
            type="button"
            role="gridcell"
            aria-label={cell ? `Cell ${index + 1}: ${cell}` : `Cell ${index + 1}: empty`}
            disabled={Boolean(cell) || Boolean(winner) || Boolean(isDraw) || (mode === 'bot' && displayedGame.turn !== 'X') || (mode === 'remote' && displayedGame.turn !== effectivePlayerMark)}
            onClick={() => handleCellClick(index)}
          >
            {cell}
          </button>
        ))}
      </div>
    </section>
  )
}

export default TicTacToe
