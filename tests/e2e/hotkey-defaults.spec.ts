import { test, expect } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { launchApp, findWindow } from './helpers'

let app: ElectronApplication

test.beforeAll(async () => {
  // 구버전 기본 단축키가 저장된 사용자를 흉내낸다 (PrtScn — Windows 기본 캡처와 충돌)
  const launched = await launchApp({
    onboardingDone: true,
    hotkeys: {
      allInOne: 'PrintScreen',
      region: 'Control+Shift+R',
      fullscreen: 'Control+Shift+F',
      window: 'Control+Shift+W',
      record: 'Control+Shift+E'
    }
  })
  app = launched.app
})

test.afterAll(async () => {
  await app?.close()
})

test('구버전 기본 단축키는 충돌 없는 새 기본값으로 마이그레이션된다', async () => {
  const library = await findWindow(app, 'library.html')
  const settings = await library.evaluate(() => window.snaply.invoke('settings:get', undefined))
  expect(settings.hotkeys.allInOne).toBe('Control+Alt+A')
  expect(settings.hotkeys.region).toBe('Control+Alt+R')
  expect(settings.hotkeys.fullscreen).toBe('Control+Alt+F')
  expect(settings.hotkeys.window).toBe('Control+Alt+W')
  expect(settings.hotkeys.record).toBe('Control+Alt+E')
})
