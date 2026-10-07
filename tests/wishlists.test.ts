import test from 'node:test'
import assert from 'node:assert/strict'
import { validateWishlistItem, filterWishlistItems } from '../src/lib/wishlists.ts'

test('wishlist item trims content and validates supported category and URL', () => {
  assert.deepEqual(validateWishlistItem('  Night market ', 'Try the dumplings', 'https://example.com', 'food'), {
    title: 'Night market', note: 'Try the dumplings', link: 'https://example.com', category: 'food',
  })
})

test('wishlist rejects blank/oversized title, oversized note, unsafe link, or unknown category', () => {
  assert.throws(() => validateWishlistItem(' ', '', '', 'food'), /title/i)
  assert.throws(() => validateWishlistItem('x'.repeat(161), '', '', 'food'), /160/)
  assert.throws(() => validateWishlistItem('Gift', 'x'.repeat(1001), '', 'gift'), /1000/)
  assert.throws(() => validateWishlistItem('Gift', '', 'javascript:alert(1)', 'gift'), /https/i)
  assert.throws(() => validateWishlistItem('Gift', '', '', 'unknown',), /category/i)
})

test('wishlist filtering uses category and completion state without mutating rows', () => {
  const rows = [
    { id: 'a', category: 'food', completed: false },
    { id: 'b', category: 'trip', completed: true },
    { id: 'c', category: 'food', completed: true },
  ]
  assert.deepEqual(filterWishlistItems(rows, { category: 'food', completed: false }).map((row) => row.id), ['a'])
  assert.equal(rows.length, 3)
})
