import { test, expect } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { launchApp, findWindow } from './helpers'

let app: ElectronApplication

test.beforeAll(async () => {
  // 영어 로케일로 시작
  const launched = await launchApp({ onboardingDone: true, language: 'en' })
  app = launched.app
})

test.afterAll(async () => {
  await app?.close()
})

test('영어 로케일이면 보관함 UI가 영어로 나온다', async () => {
  const library = await findWindow(app, 'library.html')
  await expect(library.locator('button:has-text("Capture")').first()).toBeVisible({ timeout: 10_000 })
  await expect(library.locator('text=No captures yet')).toBeVisible()
  await expect(library.locator('text=Favorites')).toBeVisible()
})

test('설정에서 한국어로 바꾸면 즉시 반영된다', async () => {
  const library = await findWindow(app, 'library.html')
  await library.evaluate(() => window.snaply.invoke('settings:set', { language: 'ko' }))
  await expect(library.locator('button:has-text("캡처하기")').first()).toBeVisible({ timeout: 5_000 })
  await expect(library.locator('text=아직 캡처가 없어요')).toBeVisible()
})
