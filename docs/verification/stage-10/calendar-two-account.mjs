import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const secondBrowser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const browsers = [browser, secondBrowser]
const contexts = await Promise.all(browsers.map((instance) => instance.newContext({ viewport: { width: 384, height: 832 }, isMobile: true, hasTouch: true })))
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
  const title = `QA Plan ${Date.now()}`
  await pages[0].getByLabel('Title', { exact: true }).fill(title)
  await pages[0].locator('#calendar-event-date').fill('2026-12-05')
  await pages[0].getByRole('button', { name: 'Add to calendar' }).click()
  await pages[0].locator('.shared-calendar').getByText(title, { exact: true }).waitFor()
  await pages[1].locator('.shared-calendar').getByRole('button', { name: 'Next month' }).click(); await pages[1].locator('.shared-calendar').getByRole('button', { name: 'Next month' }).click()
  await pages[1].locator('.shared-calendar').getByRole('gridcell', { name: /2026-12-05/ }).click()
  await pages[1].locator('.shared-calendar').getByText(title, { exact: true }).waitFor()
  await pages[0].screenshot({ path: 'docs/verification/stage-10/calendar-mobile.png', fullPage: true })
  const allDayRow = pages[1].locator('.shared-calendar .us-list li').filter({ hasText: title })
  await allDayRow.getByRole('button', { name: 'Edit' }).click()
  await pages[1].getByLabel('Title', { exact: true }).fill(`${title} edited`)
  await pages[1].getByRole('button', { name: 'Save plan' }).click()
  await pages[0].locator('.shared-calendar').getByText(`${title} edited`, { exact: true }).waitFor()
  await pages[1].getByLabel('Title', { exact: true }).fill(`${title} timed`)
  await pages[1].getByLabel('All day').uncheck()
  await pages[1].getByLabel('Start time').fill('2026-12-05T19:30')
  await pages[1].getByLabel('Timezone', { exact: true }).selectOption('Asia/Taipei')
  await pages[1].getByLabel('Notes (optional)').fill('Dinner together')
  await pages[1].getByRole('button', { name: 'Add to calendar' }).click()
  await pages[0].locator('.shared-calendar').getByRole('gridcell', { name: /2026-12-05/ }).click()
  await pages[0].locator('.shared-calendar').getByText(`${title} timed`, { exact: true }).waitFor()
  await pages[1].getByRole('button', { name: 'Upcoming' }).click()
  await pages[1].screenshot({ path: 'docs/verification/stage-10/agenda-mobile.png', fullPage: true })
  const entry = pages[1].locator('.shared-calendar .us-list li').filter({ hasText: `${title} timed` })
  await entry.waitFor(); await entry.getByRole('button', { name: 'Remove' }).click()
  await pages[1].locator('.shared-calendar').getByText(`${title} timed`, { exact: true }).waitFor({ state: 'detached' })
  await pages[0].locator('.shared-calendar').getByText(`${title} timed`, { exact: true }).waitFor({ state: 'detached' })
  const remaining = pages[1].locator('.shared-calendar .us-list li').filter({ hasText: `${title} edited` })
  await remaining.getByRole('button', { name: 'Remove' }).click()
  await pages[0].locator('.shared-calendar').getByText(`${title} edited`, { exact: true }).waitFor({ state: 'detached' })
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ flow: 'two-account all-day creation, timed event add, agenda, delete and realtime', viewport: '384x832 CSS px', consoleErrors: errors }))
} finally { await Promise.all(contexts.map((context) => context.close())); await Promise.all(browsers.map((instance) => instance.close())) }


