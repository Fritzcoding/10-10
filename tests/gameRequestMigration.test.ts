import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const legacyMigrations = 'supabase/migrations-archive/pre-baseline-manual-sql/'
const migration = readFileSync(`${legacyMigrations}202609300002_fix_game_request_recipient_reference.sql`, 'utf8')
const initialMigration = readFileSync(`${legacyMigrations}202609300001_expire_game_requests.sql`, 'utf8')

test('game request RPC avoids ambiguous recipient_id references', () => {
  assert.match(migration, /drop function if exists public\.create_game_request\(uuid\)/i)
  assert.match(migration, /create_game_request\(target_recipient_id uuid\)/)
  assert.doesNotMatch(migration, /recipient_id\s*=\s*create_game_request\.recipient_id/)
  assert.match(migration, /recipient_id\s*=\s*target_recipient_id/)
})

test('initial game request migration is safe to rerun after the RPC was renamed', () => {
  assert.match(initialMigration, /drop function if exists public\.create_game_request\(uuid\)/i)
  assert.match(initialMigration, /create_game_request\(target_recipient_id uuid\)/)
  assert.doesNotMatch(initialMigration, /create_game_request\(recipient_id uuid\)/)
})

test('accept game request RPC uses a non-colliding request parameter', () => {
  const acceptanceMigration = readFileSync(`${legacyMigrations}202609300003_fix_accept_game_request.sql`, 'utf8')
  assert.match(acceptanceMigration, /drop function if exists public\.accept_game_request\(uuid\)/i)
  assert.match(acceptanceMigration, /accept_game_request\(target_request_id uuid\)/)
  assert.match(acceptanceMigration, /gr\.id\s*=\s*target_request_id/)
  assert.match(acceptanceMigration, /'session_id', session_row\.id/)
})
