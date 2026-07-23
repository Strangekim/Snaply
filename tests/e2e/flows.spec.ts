import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, findWindow } from './helpers'

let app: ElectronApplication
let library: Page
let saveDir: string

test.beforeAll(async () => {
  saveDir = mkdtempSync(join(tmpdir(), 'snaply-e2e-save-'))
  const launched = await launchApp({ onboardingDone: true, savePath: saveDir })
  app = launched.app
  library = await findWindow(app, 'library.html')
})

test.afterAll(async () => {
  await app?.close()
})

test('보관함 상단에 캡처하기 버튼과 검색창이 있다', async () => {
  await expect(library.locator('button:has-text("캡처하기")')).toBeVisible({ timeout: 10_000 })
  await expect(library.locator('input[aria-label="보관함 검색"]')).toBeVisible()
  // 후원 버튼 (사이드바 하단)
  await expect(library.locator('button:has-text("커피 한 잔 사주기")')).toBeVisible()
})

test('전체 화면 캡처가 보관함에 자동 저장된다', async () => {
  // 오버레이 UI를 거치지 않고 IPC로 직접 커밋 (E2E 안정성)
  const result = await library.evaluate(async () => {
    const displays = await window.snaply.invoke('capture:listDisplays', undefined)
    return window.snaply.invoke('capture:commitFullscreen', { displayId: displays[0].id })
  })
  expect(result.filePath.length).toBeGreaterThan(0)
  expect(result.width).toBeGreaterThan(0)

  // 캡처 완료 토스트 + 보관함 카드 등장
  await expect(library.locator('text=캡처했어요').first()).toBeVisible({ timeout: 5_000 })
  await expect(library.locator(`text=${result.filePath.split('\\').pop()}`).first()).toBeVisible({
    timeout: 10_000
  })
})

test('캡처 후 에디터 창이 열리고 이미지가 로드된다', async () => {
  // 기본 afterCapture='editor'라 위 캡처로 에디터 창이 열렸다
  const editor = await findWindow(app, 'editor.html')
  await expect(editor.locator('canvas').first()).toBeVisible({ timeout: 10_000 })
  // 이후 테스트가 라이브러리 창 기준으로 돌 수 있게 에디터는 닫는다 (창 수명 검증 겸)
  await editor.close({ runBeforeUnload: true }).catch(() => undefined)
})

test('검색 결과가 없으면 안내 문구가 나온다', async () => {
  const search = library.locator('input[aria-label="보관함 검색"]')
  await search.fill('존재하지않는검색어xyz')
  await expect(library.locator('text=검색 결과가 없어요')).toBeVisible({ timeout: 5_000 })
  await search.fill('')
})

test('폴더를 만들면 사이드바에 나타난다', async () => {
  await library.locator('button[title="폴더를 추가해요"]').click()
  await library.getByPlaceholder('예: 업무 스크린샷').fill('E2E 테스트 폴더')
  await library.locator('button:has-text("만들어요")').click()
  await expect(library.locator('text=E2E 테스트 폴더').first()).toBeVisible({ timeout: 5_000 })
})

test('선택 모드에서 하단 액션바가 나온다', async () => {
  await library.locator('button:has-text("선택")').first().click()
  await expect(library.locator('text=0개 선택됨')).toBeVisible()
  await library.locator('button:has-text("선택 끝내기")').click()
})

test('설정 창이 열리고 단축키 섹션이 보인다', async () => {
  await library.evaluate(() => window.snaply.invoke('window:open', { window: 'settings' }))
  const settings = await findWindow(app, 'settings.html')
  await expect(settings.locator('text=단축키').first()).toBeVisible({ timeout: 10_000 })
  await expect(settings.locator('text=저장 폴더')).toBeVisible()
  // 후원 카드
  await expect(settings.locator('button:has-text("커피 한 잔 사주기")')).toBeVisible()
})

test('테마를 다크로 바꾸면 즉시 반영된다', async () => {
  const settings = await findWindow(app, 'settings.html')
  await settings.locator('button:has-text("다크")').click()
  await expect
    .poll(() => settings.evaluate(() => document.documentElement.getAttribute('data-theme')), { timeout: 5_000 })
    .toBe('dark')
  // 보관함 창에도 브로드캐스트로 전파된다
  await expect
    .poll(() => library.evaluate(() => document.documentElement.getAttribute('data-theme')), { timeout: 5_000 })
    .toBe('dark')
  await settings.locator('button:has-text("시스템")').click()
})

test('파일명 규칙 미리보기가 갱신된다', async () => {
  const settings = await findWindow(app, 'settings.html')
  const input = settings.locator('input').first()
  await input.fill('e2e-{yyyy}')
  const year = String(new Date().getFullYear())
  await expect(settings.locator(`text=e2e-${year}.png`)).toBeVisible({ timeout: 5_000 })
})

test('공유 대상 목록에 기본 3종 + 준비 중 2종이 있다', async () => {
  const targets = await library.evaluate(() => window.snaply.invoke('share:targets', undefined))
  const ids = targets.map((t) => t.id)
  expect(ids).toEqual(expect.arrayContaining(['save-as', 'clipboard', 'email', 'slack', 'gdrive']))
  expect(targets.find((t) => t.id === 'slack')?.comingSoon).toBe(true)
})

test('에디터 내보내기 시트가 6개 포맷을 보여준다', async () => {
  // 에디터 창이 닫혀 있어도 스스로 열도록 (테스트 독립성)
  const items = await library.evaluate(() => window.snaply.invoke('library:list', { limit: 1 }))
  expect(items.length).toBeGreaterThan(0)
  await library.evaluate(
    (payload) => window.snaply.invoke('window:open', { window: 'editor', payload }),
    { itemId: items[0].id, filePath: items[0].filePath }
  )
  const editor = await findWindow(app, 'editor.html')
  await expect(editor.locator('canvas').first()).toBeVisible({ timeout: 10_000 })
  await editor.locator('button:has-text("내보내기")').click()
  for (const fmt of ['PNG', 'JPG', 'WebP'.toUpperCase(), 'PDF', 'TIFF', 'PPTX']) {
    await expect(editor.locator(`text=${fmt}`).first()).toBeVisible({ timeout: 5_000 })
  }
  await editor.keyboard.press('Escape')
})

test('녹화 창이 열리고 설정 카드가 보인다', async () => {
  await library.evaluate(() => window.snaply.invoke('window:open', { window: 'recorder' }))
  const recorder = await findWindow(app, 'recorder.html')
  await expect(recorder.locator('text=MP4').first()).toBeVisible({ timeout: 10_000 })
})
