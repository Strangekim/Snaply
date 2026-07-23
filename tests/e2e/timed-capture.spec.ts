import { test, expect } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, findWindow } from './helpers'

let app: ElectronApplication

test.beforeAll(async () => {
  const saveDir = mkdtempSync(join(tmpdir(), 'snaply-timed-'))
  const launched = await launchApp({ onboardingDone: true, savePath: saveDir, afterCapture: 'clipboard' })
  app = launched.app
})

test.afterAll(async () => {
  await app?.close()
})

test('영역이 지정된 타이머 캡처는 카운트다운 후 자동으로 찍힌다', async () => {
  const library = await findWindow(app, 'library.html')
  const displays = await library.evaluate(() => window.snaply.invoke('capture:listDisplays', undefined))
  const primary = displays.find((d) => d.isPrimary) ?? displays[0]
  const before = (await library.evaluate(() => window.snaply.invoke('library:list', {}))).length

  // 영역을 미리 지정한 지연 캡처 (2초) — 오버레이 재진입 없이 자동 캡처돼야 한다
  await library.evaluate(
    (region) => window.snaply.invoke('capture:start', { mode: 'region', delayMs: 2000, region }),
    { x: 20, y: 20, width: 240, height: 160, displayId: primary.id }
  )

  // 카운트다운 중 캡처 예정 영역 포커스 테두리가 표시된다
  let focusSeen = false
  await expect
    .poll(
      async () => {
        for (const page of app.windows()) {
          if (!page.url().includes('overlay.html')) continue
          if ((await page.locator('[data-testid="focus-region"]').count()) > 0) focusSeen = true
        }
        return focusSeen
      },
      { timeout: 1_800 }
    )
    .toBe(true)

  await expect
    .poll(() => library.evaluate(() => window.snaply.invoke('library:list', {}).then((r) => r.length)), {
      timeout: 15_000
    })
    .toBe(before + 1)

  // 캡처된 크기가 지정 영역(물리 픽셀)과 일치
  const items = await library.evaluate(() => window.snaply.invoke('library:list', {}))
  const expectedW = Math.round(240 * primary.scaleFactor)
  expect(Math.abs(items[0].width - expectedW)).toBeLessThanOrEqual(2)
  expect(items[0].mode).toBe('region')
})
