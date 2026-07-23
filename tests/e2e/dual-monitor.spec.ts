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

test('선택 영역을 드롭하면 중심이 속한 모니터의 오버레이가 이어받는다', async () => {
  const displays = await library.evaluate(() => window.snaply.invoke('capture:listDisplays', undefined))
  test.skip(displays.length < 2, '모니터가 1대인 환경')

  // 영역 모드로 오버레이 열기
  await library.evaluate(() => window.snaply.invoke('capture:start', { mode: 'region' }))
  await findWindow(app, 'overlay.html')
  await new Promise((r) => setTimeout(r, 500))

  // 보조 모니터 중앙에 300×400 영역을 드롭한 것처럼 syncRect(final) 중계
  const secondary = displays.find((d) => !d.isPrimary) ?? displays[1]
  const primary = displays.find((d) => d.isPrimary) ?? displays[0]
  const abs = {
    x: Math.round(secondary.bounds.x + secondary.bounds.width / 2 - 150),
    y: Math.round(secondary.bounds.y + secondary.bounds.height / 2 - 200),
    width: 300,
    height: 400
  }
  await library.evaluate(
    ({ rect, sourceId }) => window.snaply.invoke('overlay:syncRect', { rect, final: true, sourceDisplayId: sourceId }),
    { rect: abs, sourceId: primary.id }
  )

  // 보조 모니터 오버레이가 조정 단계(크기 배지 300 × 400)로 진입했는지 확인
  let adopted = false
  await expect
    .poll(
      async () => {
        for (const page of app.windows()) {
          if (!page.url().includes('overlay.html')) continue
          const w = await page.evaluate(() => window.innerWidth).catch(() => 0)
          if (Math.abs(w - secondary.bounds.width) <= 2) {
            adopted = (await page.locator('text=300 × 400').count()) > 0
          }
        }
        return adopted
      },
      { timeout: 10_000 }
    )
    .toBe(true)

  // 정리
  for (const page of app.windows()) {
    if (page.url().includes('overlay.html')) {
      await page.keyboard.press('Escape').catch(() => undefined)
      break
    }
  }
})

test('선택은 다른 모니터, 타이머는 캡슐 모니터에서 눌러도 자동 캡처된다', async () => {
  const displays = await library.evaluate(() => window.snaply.invoke('capture:listDisplays', undefined))
  test.skip(displays.length < 2, '모니터가 1대인 환경')

  const before = (await library.evaluate(() => window.snaply.invoke('library:list', {}))).length
  await library.evaluate(() => window.snaply.invoke('capture:start', { mode: 'region' }))
  await findWindow(app, 'overlay.html')
  await new Promise((r) => setTimeout(r, 500))

  // 캡슐이 있는 창과 없는 창을 구분
  let capsulePage: Page | null = null
  let otherPage: Page | null = null
  for (const page of app.windows()) {
    if (!page.url().includes('overlay.html')) continue
    const visible = await page.evaluate(() => document.body.childElementCount > 0).catch(() => false)
    if (!visible) continue
    if ((await page.locator('button[title*="지연"], button[title*="Timed"]').count()) > 0) capsulePage = page
    else otherPage = page
  }
  expect(capsulePage, '캡슐 오버레이 창').toBeTruthy()
  expect(otherPage, '캡슐 없는 오버레이 창').toBeTruthy()

  // 캡슐이 없는(다른 모니터) 창에서 영역 드래그
  await otherPage!.mouse.move(200, 200)
  await otherPage!.mouse.down()
  await otherPage!.mouse.move(430, 380, { steps: 4 })
  await otherPage!.mouse.up()
  await expect(otherPage!.locator('text=✓ 캡처')).toBeVisible({ timeout: 5_000 })

  // 캡슐이 있는 창에서 ⏱ → 3초
  await capsulePage!.locator('button[title*="지연"], button[title*="Timed"]').first().click()
  await capsulePage!.locator('button:has-text("3초"), button:has-text("3s")').first().click()

  // 카운트다운 후 다른 모니터의 선택 영역이 자동 캡처된다
  await expect
    .poll(() => library.evaluate(() => window.snaply.invoke('library:list', {}).then((r) => r.length)), {
      timeout: 20_000
    })
    .toBe(before + 1)
  const items = await library.evaluate(() => window.snaply.invoke('library:list', {}))
  expect(items[0].mode).toBe('region')
})

test('전체 화면 카드를 클릭하면 해당 모니터가 캡처된다', async () => {
  const displays = await library.evaluate(() => window.snaply.invoke('capture:listDisplays', undefined))
  test.skip(displays.length < 2, '모니터가 1대인 환경')

  // 테스트 독립성: 전체 화면 오버레이를 직접 연다
  await library.evaluate(() => window.snaply.invoke('capture:start', { mode: 'fullscreen' }))
  await findWindow(app, 'overlay.html')
  await new Promise((r) => setTimeout(r, 500))

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
