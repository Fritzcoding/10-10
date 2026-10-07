import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 384, height: 832 }, isMobile: true, hasTouch: true })))
const pages = await Promise.all(contexts.map((context) => context.newPage()))
const errors = []
const emails = ['stage7.qa.1791299787660.a@example.test', 'stage7.qa.1791299787660.b@example.test']
try {
  await Promise.all(pages.map(async (page, i) => {
    page.setDefaultTimeout(15000); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) }); page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('http://127.0.0.1:5173')
    const accept = page.getByRole('button', { name: /accept.*continue/i })
    if (await accept.count()) { await accept.click(); await page.getByRole('button', { name: /enter our hub/i }).click() }
    await page.getByRole('tab', { name: 'Login' }).click(); await page.locator('#auth-identifier').fill(emails[i]); await page.locator('#auth-password').fill('LocalQa!9341'); await page.getByRole('button', { name: 'Enter our Hub' }).click(); await page.getByRole('button', { name: 'Us' }).waitFor()
  }))
  await Promise.all(pages.map((p) => p.getByRole('button', { name: 'Us' }).click({ force: true })))
  const title = `QA Wishlist ${Date.now()}`
  await pages[0].getByLabel('Idea').fill(title); await pages[0].getByLabel('Category', { exact: true }).selectOption('food'); await pages[0].getByLabel('Note (optional)').fill('Try the dumplings'); await pages[0].getByLabel('Link (optional)').fill('https://example.com')
  await pages[0].getByRole('button', { name: 'Add to wishlist' }).click()
  const rowA = pages[0].locator('.milestone-list li').filter({ hasText: title }); const rowB = pages[1].locator('.milestone-list li').filter({ hasText: title })
  await rowA.waitFor(); await rowB.waitFor()
  await pages[0].screenshot({ path: 'docs/verification/stage-9/wishlist-mobile.png', fullPage: true })
  await rowB.getByRole('button', { name: 'Save idea' }).click(); await rowB.getByRole('button', { name: 'Edit' }).click()
  await pages[1].getByLabel('Edit category').selectOption('trip'); await pages[1].getByLabel('Edit note').fill('Book a weekend'); await pages[1].getByLabel('Edit link').fill('https://example.org'); await pages[1].locator('.milestone-list li form.us-form button[type=submit]').click()
  await rowA.getByText(/trip/).waitFor(); await rowA.getByText('Book a weekend').waitFor()
  await rowB.getByRole('checkbox', { name: new RegExp(title) }).click(); await pages[1].waitForTimeout(500); if (!await rowB.getByRole('checkbox', { name: new RegExp(title) }).isChecked()) throw new Error('wishlist completion did not persist'); await rowA.getByText('Book a weekend').waitFor()
  await rowB.getByRole('button', { name: 'Remove' }).click(); await rowA.waitFor({ state: 'detached' })
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ flow: 'two-account categorized wishlist add/edit/save/complete/remove', viewport: '384x832 CSS px', consoleErrors: errors }))
} finally { await Promise.all(contexts.map((c) => c.close())); await browser.close() }
