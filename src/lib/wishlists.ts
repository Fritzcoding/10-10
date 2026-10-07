export const WISHLIST_CATEGORIES = ['date', 'place', 'food', 'gift', 'trip'] as const
export type WishlistCategory = typeof WISHLIST_CATEGORIES[number]
export type WishlistItem = { id: string; category: WishlistCategory; completed: boolean; saved?: boolean }

export function validateWishlistItem(title: string, note: string, link: string, category: string) {
  const cleanTitle = title.trim()
  const cleanNote = note.trim()
  const cleanLink = link.trim()
  if (!cleanTitle || cleanTitle.length > 160) throw new Error('Title must be 1 to 160 characters.')
  if (cleanNote.length > 1000) throw new Error('Note must be 1000 characters or fewer.')
  if (!WISHLIST_CATEGORIES.includes(category as WishlistCategory)) throw new Error('Choose a valid category.')
  if (cleanLink.length > 2048 || (cleanLink && !/^https?:\/\//i.test(cleanLink))) throw new Error('Link must start with http:// or https://.')
  if (cleanLink) {
    try { new URL(cleanLink) } catch { throw new Error('Enter a valid HTTP or HTTPS link.') }
  }
  return { title: cleanTitle, note: cleanNote, link: cleanLink, category: category as WishlistCategory }
}

export function filterWishlistItems<T extends WishlistItem>(items: T[], filter: { category?: string; completed?: boolean }) {
  return items.filter((item) => (!filter.category || filter.category === 'all' || item.category === filter.category)
    && (filter.completed === undefined || item.completed === filter.completed))
}
