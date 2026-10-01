import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyRemoteMove, isSessionForUser, latestGameSession, ticTacToeMoveRpcPayload, type GameSession } from '../src/lib/gameSessions.ts'

const session = (overrides: Partial<GameSession> = {}): GameSession => ({ id: 's1', game_type: 'tic-tac-toe', player_x_id: 'x-user', player_o_id: 'o-user', board: [null, null, null, null, null, null, null, null, null], turn: 'X', status: 'active', winner: null, revision: 0, deadline_at: null, ...overrides })

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

test('keeps a newer realtime board when an older refetch or RPC response arrives late', () => {
  const latest = session({ board: ['X', 'O', null, null, null, null, null, null, null], turn: 'X', revision: 2 })
  const stale = session({ board: ['X', null, null, null, null, null, null, null, null], turn: 'O', revision: 1 })
  assert.equal(latestGameSession(latest, stale), latest)
  assert.equal(latestGameSession(stale, latest), latest)
})

test('Tic-Tac-Toe move logic rejects sessions belonging to a different game', () => {
  assert.throws(() => applyRemoteMove(session({ game_type: 'would-you-rather' }), 'x-user', 0), /does not support/)
})

test('hidden answers are persisted only through the hidden-answer RPC', () => {
  const source = readFileSync(new URL('../src/lib/gameSessions.ts', import.meta.url), 'utf8')
  assert.match(source, /rpc\('submit_hidden_game_answer', hiddenAnswerInsertPayload\(sessionId, answer\)\)/)
  assert.doesNotMatch(source, /from\('game_submissions'\)\.insert/)
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

test('leaving a remote game clears the Hub-owned session so the games directory can render', () => {
  const games = readFileSync(new URL('../src/components/Games.tsx', import.meta.url), 'utf8')
  const hub = readFileSync(new URL('../src/components/Hub.tsx', import.meta.url), 'utf8')
  assert.match(games, /onSessionExit/)
  assert.match(hub, /onSessionExit=\{\(\) => setActiveSession\(null\)\}/)
})
