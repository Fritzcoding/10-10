import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Our Little Hub',
        short_name: 'Our Hub',
        description: 'A private little place for the two of us.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#fbfdff',
        theme_color: '#fbfdff',
        icons: [
          { src: '/pwa-icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/pwa-icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        importScripts: ['/push-sw.js'],
        globPatterns: ['**/*.{html,js,css,svg}'],
      },
    }),
  ],
})
