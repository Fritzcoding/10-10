import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const source = resolve(root, 'dist')
const destination = resolve(root, 'android/app/src/main/assets')
if (!existsSync(resolve(source, 'index.html'))) throw new Error('Build the Vite app before syncing Android assets.')
rmSync(destination, { recursive: true, force: true })
mkdirSync(destination, { recursive: true })
cpSync(source, destination, { recursive: true })
const androidIndex = resolve(destination, 'index.html')
writeFileSync(androidIndex, readFileSync(androidIndex, 'utf8').replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, ''))
