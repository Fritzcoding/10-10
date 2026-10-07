import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:5173'
const password = 'LocalQa!9341'
const emails = ['stage7.qa.1791299787660.a@example.test', 'stage7.qa.1791299787660.b@example.test']
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
})
const contexts = await Promise.all([0, 1].map(() => browser.newContext({
  viewport: { width: 384, height: 832 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
})))
const pages = await Promise.all(contexts.map((context) => context.newPage()))
const consoleErrors = []

for (const page of pages) {
  page.setDefaultTimeout(12000)
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
}

async function enterHub(page, email) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  const accept = page.getByRole('button', { name: /accept.*continue/i })
  if (await accept.count()) {
    await accept.click()
    await page.getByRole('button', { name: /enter our hub/i }).click()
  }
  await page.getByRole('tab', { name: 'Login' }).click()
  await page.locator('#auth-identifier').fill(email)
  await page.locator('#auth-password').fill(password)
  await page.getByRole('button', { name: 'Enter our hub' }).click()
  await page.getByRole('heading', { name: 'Draw Together' }).waitFor()
}

try {
  await Promise.all(pages.map((page, index) => enterHub(page, emails[index])))
  await pages[0].getByText('Optional reference image').waitFor()
  await pages[0].locator('input[type=file]').setInputFiles('src/assets/hero.png')
  await pages[0].getByText(/Ready for both of you/).waitFor()
  await pages[0].screenshot({ path: 'docs/verification/stage-7/reference-upload-mobile.png', fullPage: true })

  const partnerPreview = pages[1].locator('img[alt="Shared drawing reference"]')
  await partnerPreview.waitFor()
  await partnerPreview.evaluate((image) => image.decode())
  assert.ok(await partnerPreview.evaluate((image) => image.naturalWidth > 0), 'partner can download and render the private reference image')
  await pages[1].screenshot({ path: 'docs/verification/stage-7/reference-visible-to-partner-mobile.png', fullPage: true })

  await pages[0].getByRole('button', { name: 'Start drawing' }).click()
  const canvases = await Promise.all(pages.map((page) => page.locator('canvas').waitFor().then(() => page.locator('canvas').boundingBox())))
  for (let index = 0; index < pages.length; index += 1) {
    const bounds = canvases[index]
    const cdp = await contexts[index].newCDPSession(pages[index])
    const x = bounds.x + bounds.width * 0.25
    const y = bounds.y + bounds.height * 0.5
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y, radiusX: 5, radiusY: 5, force: 1 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x + 80, y: y - 30, radiusX: 5, radiusY: 5, force: 1 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const drawnPixels = await pages[index].locator('canvas').evaluate((canvas) => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
      let count = 0
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) count += 1
      return count
    })
    assert.ok(drawnPixels > 0, `mobile touch gesture draws on account ${index + 1}'s canvas`)
    await pages[index].screenshot({ path: `docs/verification/stage-7/touch-drawing-${index + 1}-mobile.png`, fullPage: true })
  }

  await pages[0].getByRole('button', { name: 'Submit drawing' }).click()
  await pages[0].getByText(/Your drawing is private/).waitFor()
  assert.equal(await pages[0].locator('.drawing-game__reveal').count(), 0, 'first submitted drawing remains hidden')
  await pages[0].screenshot({ path: 'docs/verification/stage-7/private-first-submission-mobile.png', fullPage: true })
  await pages[1].getByRole('button', { name: 'Submit drawing' }).click()
  await pages[0].getByRole('heading', { name: 'Your drawings' }).waitFor()
  await pages[1].getByRole('heading', { name: 'Your drawings' }).waitFor()
  await Promise.all(pages.map((page, index) => page.screenshot({ path: `docs/verification/stage-7/reveal-${index + 1}-mobile.png`, fullPage: true })))
  assert.deepEqual(consoleErrors, [], `browser console is clean: ${consoleErrors.join('; ')}`)
  console.log(JSON.stringify({ flow: 'local authenticated couple session, PNG reference upload, partner download, mobile touch strokes, private first submission, joint reveal', viewport: '384x832 CSS px; mobile/touch emulation', consoleErrors }))
} finally {
  await browser.close()
}
