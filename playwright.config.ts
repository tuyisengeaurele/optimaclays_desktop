import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  // Every spec launches the real Electron app against the same SQLite file,
  // so running spec files in parallel workers causes cross-process write
  // contention on the database. Keep this serial.
  workers: 1
})
