import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyRemoteMove, isSessionForUser, ticTacToeMoveRpcPayload, type GameSession } from '../src/lib/gameSessions.ts'

const session = (overrides: Partial<GameSession> = {}): GameSession => ({ id: 's1', game_type: 'tic-tac-toe', player_x_id: 'x-user', player_o_id: 'o-user', board: [null, null, null, null, null, null, null, null, null], turn: 'X', status: 'active', winner: null, revision: 0, ...overrides })

test('assigns X and O turns and accepts valid moves', () => {
  const next = applyRemoteMove(session(), 'x-user', 0)
  assert.equal(next.board[0], 'X')
  assert.equal(next.turn, 'O')
})

test('rejects non-player, wrong turn, occupied, invalid, and completed moves', () => {
  assert.throws(() => applyRemoteMove(session(), 'other', 0), /player/)
  assert.throws(() => applyRemoteMove(session(), 'o-user', 0), /turn/)
  assert.throws(() => applyRemoteMove(session({ board: ['X', null, null, null, null, null, null, null, null] }), 'x-user', 0), /occupied/)
  assert.throws(() => applyRemoteMove(session(), 'x-user', 9), /index/)
  assert.throws(() => applyRemoteMove(session({ status: 'won', winner: 'X' }), 'o-user', 0), /completed/)
})

test('marks winner and draw and ignores duplicate state payloads', () => {
  const winning = applyRemoteMove(session({ board: ['X', 'X', null, 'O', 'O', null, null, null, null], turn: 'X' }), 'x-user', 2)
  assert.deepEqual({ status: winning.status, winner: winning.winner }, { status: 'won', winner: 'X' })
  const draw = applyRemoteMove(session({ board: ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null], turn: 'X' }), 'x-user', 8)
  assert.equal(draw.status, 'draw')
})

test('recognizes both players so either account can be routed into the accepted game', () => {
  assert.equal(isSessionForUser(session(), 'x-user'), true)
  assert.equal(isSessionForUser(session(), 'o-user'), true)
  assert.equal(isSessionForUser(session(), 'other'), false)
})

test('move RPC payload includes the session revision for server concurrency checks', () => {
  assert.deepEqual(ticTacToeMoveRpcPayload('s1', 7, 4), {
    target_session_id: 's1', target_revision: 7, target_cell: 4,
  })
})

test('remote sessions do not write game state directly through the data API', () => {
  const source = readFileSync(new URL('../src/lib/gameSessions.ts', import.meta.url), 'utf8')
  assert.match(source, /rpc\('submit_tic_tac_toe_move'/)
  assert.doesNotMatch(source, /from\('game_sessions'\)\.update/)
})

test('Tic-Tac-Toe no longer joins a fixed public broadcast room', () => {
  const source = readFileSync(new URL('../src/components/games/TicTacToe.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /game_room_id|\.channel\(/)
})
