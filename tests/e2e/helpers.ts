import { _electron as electron, type ElectronApplication, type Page } from 'playwright'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/** 빌드된 앱을 임시 userData로 기동한다 (설정/DB 오염 방지).
 * 사전 조건: `npm run build`로 out/이 최신이어야 한다 */
export async function launchApp(
  presetSettings: Record<string, unknown> = { onboardingDone: true }
): Promise<{ app: ElectronApplication; userData: string }> {
  const userData = mkdtempSync(join(tmpdir(), 'snaply-e2e-'))
  // 온보딩 등 첫 실행 상태를 테스트별로 제어할 수 있게 설정을 미리 심는다
  writeFileSync(join(userData, 'settings.json'), JSON.stringify(presetSettings), 'utf-8')
  const app = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js'), `--user-data-dir=${userData}`],
    env: {
      ...process.env,
      SNAPLY_E2E: '1',
      SNAPLY_USER_DATA: userData
    }
  })
  return { app, userData }
}

/** 제목 또는 URL 조각으로 창을 찾는다 */
export async function findWindow(app: ElectronApplication, urlPart: string, timeoutMs = 15_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    for (const page of app.windows()) {
      if (page.url().includes(urlPart)) return page
    }
    if (Date.now() > deadline) throw new Error(`창을 찾지 못했어요: ${urlPart}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}
