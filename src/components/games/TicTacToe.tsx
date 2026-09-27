import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { applyMove, chooseBotMove, createInitialGameState, getGameOutcome, type Board, type GameState, type Mark } from '../../lib/ticTacToe'
import { supabase } from '../../lib/supabase'
import './TicTacToe.css'

const GAME_ROOM_ID = 'game_room_id'

type MovePayload = {
  type: 'move'
  board: Board
  turn: Mark
}

function getPlayerMark(userId: string | undefined): Mark {
  if (!userId) return 'X'
  return Number.parseInt(userId.slice(-1), 16) % 2 === 0 ? 'X' : 'O'
}

export type TicTacToeMode = 'bot' | 'local' | 'remote'
type TicTacToeProps = { mode?: TicTacToeMode; remoteState?: GameState; playerMark?: Mark; onMove?: (index: number) => void }

function TicTacToe({ mode = 'local', remoteState, playerMark: requestedPlayerMark, onMove }: TicTacToeProps) {
  const [game, setGame] = useState<GameState>(createInitialGameState)
  const [playerMark, setPlayerMark] = useState<Mark>('X')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const displayedGame = mode === 'remote' && remoteState ? remoteState : game
  const { winner, draw: isDraw } = getGameOutcome(displayedGame.board)
  const effectivePlayerMark = requestedPlayerMark ?? playerMark

  useEffect(() => {
    if (mode !== 'bot' || displayedGame.turn !== 'O' || winner || isDraw) return
    const timer = window.setTimeout(() => {
      const move = chooseBotMove(displayedGame)
      if (move !== null) broadcastGame(applyMove(displayedGame, move))
    }, 350)
    return () => window.clearTimeout(timer)
  // The callback intentionally uses the current channel ref and rendered state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedGame, isDraw, mode, requestedPlayerMark, winner])

  useEffect(() => {
    if (mode === 'bot' || mode === 'remote' || !supabase) return
    const client = supabase

    let isMounted = true
    void client.auth.getUser().then(({ data }) => {
      if (isMounted) setPlayerMark(getPlayerMark(data.user?.id))
    })

    const channel = client
      .channel(GAME_ROOM_ID)
      .on('broadcast', { event: 'move' }, ({ payload }: { payload: MovePayload }) => {
        if (payload.type !== 'move' || payload.board.length !== 9) return
        setGame({ board: payload.board, turn: payload.turn })
      })

    channelRef.current = channel
    void channel.subscribe()

    return () => {
      isMounted = false
      channelRef.current = null
      void client.removeChannel(channel)
    }
  }, [mode])

  function broadcastGame(nextGame: GameState) {
    setGame(nextGame)
    onMove?.(nextGame.board.findIndex((cell, index) => cell !== displayedGame.board[index]))
    if (mode === 'bot' || mode === 'remote') return
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'move',
      payload: { type: 'move', board: nextGame.board, turn: nextGame.turn } satisfies MovePayload,
    })
  }

  const handleCellClick = (index: number) => {
    if (winner || isDraw || displayedGame.turn !== effectivePlayerMark || displayedGame.board[index]) return
    if (mode === 'remote') {
      onMove?.(index)
      return
    }
    broadcastGame(applyMove(displayedGame, index))
  }

  const resetGame = () => { if (mode !== 'remote') broadcastGame(createInitialGameState()) }

  return (
    <section className="tic-tac-toe" aria-labelledby="tic-tac-toe-title">
      <header className="tic-tac-toe__header">
        <div>
          <p className="hub-panel__eyebrow">A tiny classic</p>
          <h2 id="tic-tac-toe-title">Tic-Tac-Toe</h2>
        </div>
        <button className="tic-tac-toe__reset" type="button" onClick={resetGame}>Reset Game</button>
      </header>
      <div className="tic-tac-toe__status" aria-live="polite">
        {winner ? `${winner} wins!` : isDraw ? 'It’s a draw.' : `${displayedGame.turn}'s turn`}
        <span>You are {effectivePlayerMark}</span>
      </div>
      <div className="tic-tac-toe__board" role="grid" aria-label="Tic-Tac-Toe board">
        {displayedGame.board.map((cell, index) => (
          <button
            key={index}
            className={`tic-tac-toe__cell tic-tac-toe__cell--${cell?.toLowerCase() ?? 'empty'}`}
            type="button"
            role="gridcell"
            aria-label={cell ? `Cell ${index + 1}: ${cell}` : `Cell ${index + 1}: empty`}
            disabled={Boolean(cell) || Boolean(winner) || Boolean(isDraw) || displayedGame.turn !== effectivePlayerMark}
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
