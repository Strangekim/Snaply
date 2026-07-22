import { test, expect } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { launchApp, findWindow } from './helpers'

let app: ElectronApplication

test.beforeAll(async () => {
  // 첫 실행 상태 (온보딩 미완료)
  const launched = await launchApp({ onboardingDone: false })
  app = launched.app
})

test.afterAll(async () => {
  await app?.close()
})

test('첫 실행이면 온보딩이 뜬다', async () => {
  const library = await findWindow(app, 'library.html')
  await expect(library.locator('text=만나서 반가워요')).toBeVisible({ timeout: 10_000 })
})

test('온보딩 3단계를 지나면 보관함이 보이고 다시 뜨지 않는다', async () => {
  const library = await findWindow(app, 'library.html')
  await library.locator('button:has-text("다음")').click()
  await expect(library.locator('text=단축키 하나면 돼요')).toBeVisible()
  await library.locator('button:has-text("다음")').click()
  await library.locator('button:has-text("시작하기")').click()
  await expect(library.locator('text=만나서 반가워요')).toBeHidden()

  // onboardingDone이 저장됐는지 IPC로 확인
  const done = await library.evaluate(async () => {
    const s = await window.snaply.invoke('settings:get', undefined)
    return s.onboardingDone
  })
  expect(done).toBe(true)
})
