import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { applyMove, createInitialGameState, getWinner, type Board, type GameState, type Mark } from '../../lib/ticTacToe'
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

function TicTacToe() {
  const [game, setGame] = useState<GameState>(createInitialGameState)
  const [playerMark, setPlayerMark] = useState<Mark>('X')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const winner = getWinner(game.board)
  const isDraw = !winner && game.board.every(Boolean)

  useEffect(() => {
    if (!supabase) return
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
  }, [])

  const broadcastGame = (nextGame: GameState) => {
    setGame(nextGame)
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'move',
      payload: { type: 'move', board: nextGame.board, turn: nextGame.turn } satisfies MovePayload,
    })
  }

  const handleCellClick = (index: number) => {
    if (winner || isDraw || game.turn !== playerMark || game.board[index]) return
    broadcastGame(applyMove(game, index))
  }

  const resetGame = () => broadcastGame(createInitialGameState())

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
        {winner ? `${winner} wins!` : isDraw ? 'It’s a draw.' : `${game.turn}'s turn`}
        <span>You are {playerMark}</span>
      </div>
      <div className="tic-tac-toe__board" role="grid" aria-label="Tic-Tac-Toe board">
        {game.board.map((cell, index) => (
          <button
            key={index}
            className={`tic-tac-toe__cell tic-tac-toe__cell--${cell?.toLowerCase() ?? 'empty'}`}
            type="button"
            role="gridcell"
            aria-label={cell ? `Cell ${index + 1}: ${cell}` : `Cell ${index + 1}: empty`}
            disabled={Boolean(cell) || Boolean(winner) || Boolean(isDraw) || game.turn !== playerMark}
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
