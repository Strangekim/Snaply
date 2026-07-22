import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1, // Electron 앱은 단일 인스턴스 락이 있어 직렬 실행
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure'
  }
})
