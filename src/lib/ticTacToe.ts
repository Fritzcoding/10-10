export type Mark = 'X' | 'O'
export type Cell = Mark | null
export type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell]

export type GameState = {
  board: Board
  turn: Mark
}

export function createInitialGameState(): GameState {
  return {
    board: [null, null, null, null, null, null, null, null, null],
    turn: 'X',
  }
}

export function applyMove(state: GameState, index: number): GameState {
  if (index < 0 || index > 8 || state.board[index] !== null) return state

  const board = [...state.board] as Board
  board[index] = state.turn

  return {
    board,
    turn: state.turn === 'X' ? 'O' : 'X',
  }
}

export function getWinner(board: Board): Mark | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ]

  for (const [first, second, third] of lines) {
    if (board[first] && board[first] === board[second] && board[first] === board[third]) {
      return board[first]
    }
  }

  return null
}
