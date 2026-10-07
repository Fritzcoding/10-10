import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 384, height: 832 }, isMobile: true, hasTouch: true })))
const pages = await Promise.all(contexts.map((context) => context.newPage()))
const errors = []
const emails = ['stage7.qa.1791299787660.a@example.test', 'stage7.qa.1791299787660.b@example.test']
const password = 'LocalQa!9341'

try {
  for (const page of pages) {
    page.setDefaultTimeout(15000)
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('pageerror', (error) => errors.push(error.message))
  }
  await Promise.all(pages.map(async (page, i) => {
    await page.goto('http://127.0.0.1:5173')
    const accept = page.getByRole('button', { name: /accept.*continue/i })
    if (await accept.count()) { await accept.click(); await page.getByRole('button', { name: /enter our hub/i }).click() }
    await page.getByRole('tab', { name: 'Login' }).click()
    await page.locator('#auth-identifier').fill(emails[i])
    await page.locator('#auth-password').fill(password)
    await page.getByRole('button', { name: 'Enter our Hub' }).click()
    await page.getByRole('button', { name: 'Us' }).waitFor()
  }))
  await Promise.all(pages.map(async (page, i) => {
    await page.screenshot({ path: `docs/verification/stage-8/pre-us-${i + 1}.png`, fullPage: true })
    console.log(JSON.stringify(await page.getByRole('button', { name: 'Us' }).evaluate((el) => {
      const rect = el.getBoundingClientRect(); const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return { nav: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, hit: hit?.outerHTML.slice(0, 100) }
    })))
    await page.getByRole('button', { name: 'Us' }).click({ force: true })
  }))
  await Promise.all(pages.map((page) => page.getByRole('heading', { name: 'Key dates' }).waitFor()))
  const title = `QA Anniversary ${Date.now()}`
  await pages[0].getByLabel('Date name').fill(title)
  await pages[0].getByLabel('Date', { exact: true }).fill('2030-01-14')
  await pages[0].getByLabel('Type').selectOption('anniversary')
  await pages[0].getByLabel('Repeat every year').check()
  await pages[0].getByRole('button', { name: 'Add key date' }).click()
  await pages[0].locator('.us-list li').filter({ hasText: title }).waitFor()
  await pages[1].locator('.us-list li').filter({ hasText: title }).waitFor()
  await pages[0].screenshot({ path: 'docs/verification/stage-8/countdown-mobile.png', fullPage: true })
  await pages[1].getByRole('button', { name: 'Edit', exact: true }).last().click()
  await pages[1].getByLabel('Date name').fill(`${title} edited`)
  await pages[1].getByRole('button', { name: 'Save changes' }).click()
  await pages[0].locator('.us-list li').filter({ hasText: `${title} edited` }).waitFor()
  await pages[1].locator('.milestone-list li').filter({ hasText: `${title} edited` }).getByRole('button', { name: 'Remove' }).click()
  await pages[1].locator('.milestone-list li').filter({ hasText: `${title} edited` }).waitFor({ state: 'detached' })
  await pages[0].locator('.milestone-list li').filter({ hasText: `${title} edited` }).waitFor({ state: 'detached' })
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ flow: 'local two-account milestone create, realtime read, edit, and delete', viewport: '384x832 CSS px', consoleErrors: errors }))
} finally {
  await Promise.all(contexts.map((context) => context.close()))
  await browser.close()
}
