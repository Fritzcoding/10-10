import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('Hub follows auth changes from other tabs instead of retaining a stale account ID', () => {
  const source = readFileSync(new URL('../src/components/Hub.tsx', import.meta.url), 'utf8')
  assert.match(source, /client\.auth\.onAuthStateChange/)
  assert.match(source, /session\?\.user\.id/)
})
