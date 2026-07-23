import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, findWindow } from './helpers'

/** 듀얼 모니터 전용 회귀 테스트 — 모니터가 1대면 자동 스킵 */
let app: ElectronApplication
let library: Page

test.beforeAll(async () => {
  const saveDir = mkdtempSync(join(tmpdir(), 'snaply-dual-'))
  const launched = await launchApp({ onboardingDone: true, savePath: saveDir })
  app = launched.app
  library = await findWindow(app, 'library.html')
})

test.afterAll(async () => {
  await app?.close()
})

test('디스플레이마다 오버레이 창이 생기고 각 화면을 정확히 덮는다', async () => {
  const displays = await library.evaluate(() => window.snaply.invoke('capture:listDisplays', undefined))
  test.skip(displays.length < 2, '모니터가 1대인 환경')

  await library.evaluate(() => window.snaply.invoke('capture:start', { mode: 'fullscreen' }))

  // 오버레이 창들이 뜰 때까지 대기 후 bounds 검증
  await expect
    .poll(
      () =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().filter((w) => w.getTitle() === 'Snaply 캡처' && w.isVisible()).length
        ),
      { timeout: 15_000 }
    )
    .toBe(displays.length)

  const overlayBounds = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .filter((w) => w.getTitle() === 'Snaply 캡처' && w.isVisible())
      .map((w) => w.getBounds())
  )
  for (const d of displays) {
    const match = overlayBounds.find(
      (b) =>
        Math.abs(b.x - d.bounds.x) <= 1 &&
        Math.abs(b.y - d.bounds.y) <= 1 &&
        Math.abs(b.width - d.bounds.width) <= 2 &&
        Math.abs(b.height - d.bounds.height) <= 2
    )
    expect(match, `디스플레이 ${d.id}를 덮는 오버레이 창이 있어야 해요`).toBeTruthy()
  }
})

test('전체 화면 카드를 클릭하면 해당 모니터가 캡처된다', async () => {
  const displays = await library.evaluate(() => window.snaply.invoke('capture:listDisplays', undefined))
  test.skip(displays.length < 2, '모니터가 1대인 환경')

  const before = (await library.evaluate(() => window.snaply.invoke('library:list', {}))).length

  // 두 번째 디스플레이의 오버레이 페이지에서 카드 클릭
  const secondary = displays.find((d) => !d.isPrimary) ?? displays[1]
  let picked: Page | null = null
  for (const page of app.windows()) {
    if (!page.url().includes('overlay.html')) continue
    const info = await page
      .evaluate(() => ({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }))
      .catch(() => null)
    console.log('overlay page:', JSON.stringify(info), 'want width', secondary.bounds.width)
    if (info && Math.abs(info.w - secondary.bounds.width) <= 2) picked = page
  }
  expect(picked, '보조 모니터 오버레이 창을 찾아야 해요').toBeTruthy()
  // 카드 표시 확인 후, 디스플레이 영역(카드 내부는 pointer-events:none) 중앙을 클릭
  await expect(picked!.locator('text=클릭하면 이 화면을 캡처해요')).toBeVisible({ timeout: 10_000 })
  await picked!.mouse.click(secondary.bounds.width / 2, secondary.bounds.height / 2)

  // 라이브러리에 항목 추가 + 해상도가 보조 모니터 물리 해상도와 일치
  await expect
    .poll(() => library.evaluate(() => window.snaply.invoke('library:list', {}).then((r) => r.length)), {
      timeout: 10_000
    })
    .toBe(before + 1)
  const items = await library.evaluate(() => window.snaply.invoke('library:list', {}))
  const expectedW = Math.round(secondary.bounds.width * secondary.scaleFactor)
  expect(Math.abs(items[0].width - expectedW)).toBeLessThanOrEqual(2)
})
