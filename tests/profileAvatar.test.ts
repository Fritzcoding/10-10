import test from 'node:test'
import assert from 'node:assert/strict'
import * as avatar from '../src/lib/profileAvatar.ts'

test('accepts JPEG, PNG and WebP files up to 5 MiB', () => {
  assert.equal(typeof avatar.isValidAvatarFile, 'function')
  if (typeof avatar.isValidAvatarFile !== 'function') return
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(avatar.isValidAvatarFile({ type, size: 5 * 1024 * 1024 }), true)
  }
})

test('rejects unsupported, empty and oversized images', () => {
  assert.equal(typeof avatar.isValidAvatarFile, 'function')
  if (typeof avatar.isValidAvatarFile !== 'function') return
  assert.equal(avatar.isValidAvatarFile({ type: 'image/gif', size: 100 }), false)
  assert.equal(avatar.isValidAvatarFile({ type: 'image/svg+xml', size: 100 }), false)
  assert.equal(avatar.isValidAvatarFile({ type: 'image/png', size: 0 }), false)
  assert.equal(avatar.isValidAvatarFile({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }), false)
})

test('builds a stable user-owned avatar path and rejects malformed ids', () => {
  assert.equal(typeof avatar.profileAvatarPath, 'function')
  if (typeof avatar.profileAvatarPath !== 'function') return
  assert.equal(avatar.profileAvatarPath('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/avatar')
  assert.throws(() => avatar.profileAvatarPath('not-an-id'), /user id/i)
})

test('keeps legacy HTTP URLs distinguishable from private Storage paths', () => {
  assert.equal(typeof avatar.isRemoteAvatarUrl, 'function')
  if (typeof avatar.isRemoteAvatarUrl !== 'function') return
  assert.equal(avatar.isRemoteAvatarUrl('https://example.com/avatar.png'), true)
  assert.equal(avatar.isRemoteAvatarUrl('http://example.com/avatar.png'), true)
  assert.equal(avatar.isRemoteAvatarUrl('https://'), false)
  assert.equal(avatar.isRemoteAvatarUrl('aaaaaaaa/avatar'), false)
})
