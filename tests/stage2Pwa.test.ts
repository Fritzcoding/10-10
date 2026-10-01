import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const hubCss = readFileSync(new URL('../src/components/HubTheme.css', import.meta.url), 'utf8')
const baseCss = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const pwaIcon = readFileSync(new URL('../public/pwa-icon.svg', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('manifest describes an installable standalone couple app with launch icons', () => {
  assert.match(viteConfig, /name:\s*'Our Little Hub'/)
  assert.match(viteConfig, /display:\s*'standalone'/)
  assert.match(viteConfig, /start_url:\s*'\/'/)
  assert.match(viteConfig, /sizes:\s*'192x192'/)
  assert.match(viteConfig, /sizes:\s*'512x512'/)
  assert.match(pwaIcon, /<svg[^>]+viewBox="0 0 512 512"/)
})

test('PWA update worker retains push handling and caches only the static shell', () => {
  assert.match(viteConfig, /VitePWA\(/)
  assert.match(viteConfig, /registerType:\s*['"]autoUpdate['"]|registerType:\s*['"]prompt['"]/)
  assert.match(viteConfig, /importScripts:\s*\[['"]\/push-sw\.js['"]\]/)
  assert.match(viteConfig, /globPatterns:\s*\[['"][^\]]*html[^\]]*js[^\]]*css/)
  assert.doesNotMatch(viteConfig, /runtimeCaching\s*:/)
  assert.doesNotMatch(main, /serviceWorker\.register/)
})

test('mobile shell opts into safe areas and keeps the four tabs usable', () => {
  assert.match(html, /viewport-fit=cover/)
  assert.match(html, /interactive-widget=resizes-content/)
  assert.match(hubCss, /grid-template-columns:\s*repeat\(4,/)
  assert.match(hubCss, /safe-area-inset-bottom/)
  assert.match(baseCss, /font-size:\s*16px/)
})

test('signed-in theme uses blue accents with a gray hub panel', () => {
  assert.match(hubCss, /--hub-bg:\s*#f[0-9a-f]{5}/i)
  assert.match(hubCss, /--hub-accent:\s*#e[0-9a-f]{5}/i)
  assert.match(hubCss, /background:\s*var\(--hub-panel\)/)
  assert.match(hubCss, /--hub-panel:\s*#(?:e|f)[0-9a-f]{5}/i)
})
