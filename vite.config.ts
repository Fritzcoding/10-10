import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The shared 1010 workspace stores its local Supabase env file one level up.
  envDir: '../',
})
