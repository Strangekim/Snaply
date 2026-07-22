import { test, expect } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { launchApp, findWindow } from './helpers'

let app: ElectronApplication

test.beforeAll(async () => {
  const launched = await launchApp()
  app = launched.app
})

test.afterAll(async () => {
  await app?.close()
})

test('앱이 기동되고 보관함 창이 뜬다', async () => {
  const library = await findWindow(app, 'library.html')
  await expect(library.locator('text=Snaply').first()).toBeVisible({ timeout: 10_000 })
})

test('보관함 빈 상태 문구가 보인다', async () => {
  const library = await findWindow(app, 'library.html')
  await expect(library.locator('text=아직 캡처가 없어요')).toBeVisible({ timeout: 10_000 })
})
