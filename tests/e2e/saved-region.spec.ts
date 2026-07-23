import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, findWindow } from './helpers'

let app: ElectronApplication

async function findCapsuleOverlay(appRef: ElectronApplication): Promise<Page> {
  let found: Page | null = null
  await expect
    .poll(
      async () => {
        for (const page of appRef.windows()) {
          if (!page.url().includes('overlay.html')) continue
          if ((await page.locator('button[title*="지연"], button[title*="Timed"]').count()) > 0) {
            found = page
            return true
          }
        }
        return false
      },
      { timeout: 10_000 }
    )
    .toBe(true)
  return found!
}

test.beforeAll(async () => {
  const saveDir = mkdtempSync(join(tmpdir(), 'snaply-savedregion-'))
  const launched = await launchApp({ onboardingDone: true, savePath: saveDir, afterCapture: 'clipboard' })
  app = launched.app
})

test.afterAll(async () => {
  await app?.close()
})

test('영역을 저장하면 설정에 남고, ★ 목록에서 ⚡로 즉시 캡처된다', async () => {
  const library = await findWindow(app, 'library.html')
  const before = (await library.evaluate(() => window.snaply.invoke('library:list', {}))).length

  // 1) 영역 드래그 → ☆ 영역 저장
  await library.evaluate(() => window.snaply.invoke('capture:start', { mode: 'region' }))
  let overlay = await findCapsuleOverlay(app)
  await overlay.mouse.move(260, 260)
  await overlay.mouse.down()
  await overlay.mouse.move(500, 420, { steps: 4 })
  await overlay.mouse.up()
  await overlay.locator('button:has-text("영역 저장"), button:has-text("Save region")').click()
  await expect(overlay.getByText(/저장됨|Saved/).first()).toBeVisible({ timeout: 3_000 })

  const saved = await library.evaluate(() =>
    window.snaply.invoke('settings:get', undefined).then((s) => s.savedRegions ?? [])
  )
  console.log('savedRegions:', JSON.stringify(saved))
  expect(saved).toHaveLength(1)
  expect(saved[0].rect.width).toBe(240)

  // 2) 오버레이 닫고 다시 열어 ★ 목록에서 ⚡(즉시 캡처)
  await overlay.keyboard.press('Escape')
  await library.evaluate(() => window.snaply.invoke('capture:start', { mode: 'region' }))
  overlay = await findCapsuleOverlay(app)
  await overlay.locator('button[title*="저장한 영역"], button[title*="Saved regions"]').click()
  await overlay.locator('button[title*="바로 캡처"], button[title*="Capture now"]').first().click()

  await expect
    .poll(() => library.evaluate(() => window.snaply.invoke('library:list', {}).then((r) => r.length)), {
      timeout: 10_000
    })
    .toBe(before + 1)
  const items = await library.evaluate(() => window.snaply.invoke('library:list', {}))
  expect(items[0].mode).toBe('region')
})
