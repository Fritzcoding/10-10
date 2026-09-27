export type Mark = 'X' | 'O'
export type Cell = Mark | null
export type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell]

export type GameState = {
  board: Board
  turn: Mark
}

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const

export function createInitialGameState(): GameState {
  return {
    board: [null, null, null, null, null, null, null, null, null],
    turn: 'X',
  }
}

export function applyMove(state: GameState, index: number): GameState {
  if (index < 0 || index > 8 || state.board[index] !== null || getGameOutcome(state.board).winner || getGameOutcome(state.board).draw) return state

  const board = [...state.board] as Board
  board[index] = state.turn

  return {
    board,
    turn: state.turn === 'X' ? 'O' : 'X',
  }
}

export function getWinner(board: Board): Mark | null {
  for (const [first, second, third] of WINNING_LINES) {
    if (board[first] && board[first] === board[second] && board[first] === board[third]) {
      return board[first]
    }
  }

  return null
}

export function getAvailableMoves(board: Board): number[] {
  return board.reduce<number[]>((moves, cell, index) => {
    if (cell === null) moves.push(index)
    return moves
  }, [])
}

export function getGameOutcome(board: Board): { winner: Mark | null; draw: boolean } {
  const winner = getWinner(board)
  return { winner, draw: !winner && getAvailableMoves(board).length === 0 }
}

export function chooseBotMove(state: GameState): number | null {
  if (getGameOutcome(state.board).winner || getGameOutcome(state.board).draw) return null
  return getAvailableMoves(state.board)[0] ?? null
}
