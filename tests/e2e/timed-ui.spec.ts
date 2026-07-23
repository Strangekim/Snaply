import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, findWindow } from './helpers'

let app: ElectronApplication

test.beforeAll(async () => {
  const saveDir = mkdtempSync(join(tmpdir(), 'snaply-timedui-'))
  const launched = await launchApp({ onboardingDone: true, savePath: saveDir, afterCapture: 'clipboard' })
  app = launched.app
})

test.afterAll(async () => {
  await app?.close()
})

test('실제 UI로: 영역 드래그 → ⏱ 3초 → 자동 캡처', async () => {
  const library = await findWindow(app, 'library.html')
  const before = (await library.evaluate(() => window.snaply.invoke('library:list', {}))).length

  await library.evaluate(() => window.snaply.invoke('capture:start', { mode: 'region' }))
  await findWindow(app, 'overlay.html')

  // 캡슐이 있는(커서 디스플레이) 오버레이 찾기
  let overlay: Page | null = null
  await expect
    .poll(
      async () => {
        for (const page of app.windows()) {
          if (!page.url().includes('overlay.html')) continue
          if ((await page.locator('button[title*="지연"], button[title*="Timed"]').count()) > 0) {
            overlay = page
            return true
          }
        }
        return false
      },
      { timeout: 10_000 }
    )
    .toBe(true)

  // 영역 드래그 (300,300) → (520,470)
  await overlay!.mouse.move(300, 300)
  await overlay!.mouse.down()
  await overlay!.mouse.move(520, 470, { steps: 5 })
  await overlay!.mouse.up()
  await expect(overlay!.locator('text=✓ 캡처')).toBeVisible({ timeout: 5_000 })

  // 조정 단계에서 캡슐의 ⏱ → 3초
  await overlay!.locator('button[title*="지연"], button[title*="Timed"]').first().click()
  await overlay!.locator('button:has-text("3초")').click()

  // 카운트다운 후 자동 캡처 → 보관함 +1
  await expect
    .poll(() => library.evaluate(() => window.snaply.invoke('library:list', {}).then((r) => r.length)), {
      timeout: 20_000
    })
    .toBe(before + 1)
  const items = await library.evaluate(() => window.snaply.invoke('library:list', {}))
  expect(items[0].mode).toBe('region')
})
