import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'db-jong-hum': ['./src/db_jong_hum.js'],
          'db-jong-nat': ['./src/db_jong_nat.js'],
          'db-gyogwa-hum': ['./src/db_gyogwa_hum.js'],
          'db-gyogwa-nat': ['./src/db_gyogwa_nat.js'],
        }
      }
    }
  }
})
