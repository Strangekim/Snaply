import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, findWindow } from './helpers'

let app: ElectronApplication

test.beforeAll(async () => {
  const launched = await launchApp({ onboardingDone: true })
  app = launched.app
})

test.afterAll(async () => {
  await app?.close()
})

test('고정 크기(300×400)를 적용하면 그 크기의 선택 영역이 조정 단계로 뜬다', async () => {
  const library = await findWindow(app, 'library.html')
  await library.evaluate(() => window.snaply.invoke('capture:start', { mode: 'region' }))
  await findWindow(app, 'overlay.html')

  // 캡슐(크기 버튼)이 있는 오버레이 창 찾기 — 커서가 있는 디스플레이에만 뜬다
  let capsulePage: Page | null = null
  await expect
    .poll(
      async () => {
        for (const page of app.windows()) {
          if (!page.url().includes('overlay.html')) continue
          if ((await page.locator('button:has-text("크기")').count()) > 0) {
            capsulePage = page
            return true
          }
        }
        return false
      },
      { timeout: 10_000 }
    )
    .toBe(true)

  const overlay = capsulePage!
  await overlay.locator('button:has-text("크기")').click()
  await overlay.locator('input[aria-label="너비"]').fill('300')
  await overlay.locator('input[aria-label="높이"]').fill('400')
  await overlay.locator('button:has-text("적용")').click()

  // 조정 단계: 크기 배지에 300 × 400, 캡처 액션바 표시
  await expect(overlay.locator('text=300 × 400').first()).toBeVisible({ timeout: 5_000 })
  await expect(overlay.locator('text=✓ 캡처')).toBeVisible()

  // ESC로 취소 (실제 캡처는 다른 스펙에서 검증)
  await overlay.keyboard.press('Escape')
})
