import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { AppSettings, HotkeySettings } from '@shared/ipc'

const defaults = (): AppSettings => ({
  // OS 예약 단축키와 충돌하지 않는 조합 — Windows: PrtScn은 기본 캡처 도구가 가로채고,
  // macOS: Cmd+Shift+3/4/5는 시스템 스크린샷이라 피한다. Ctrl+Alt(⌃⌥)는 양쪽 모두 안전지대.
  hotkeys: {
    allInOne: 'Control+Alt+A',
    region: 'Control+Alt+R',
    fullscreen: 'Control+Alt+F',
    window: 'Control+Alt+W',
    record: 'Control+Alt+E'
  },
  savePath: join(app.getPath('pictures'), 'Snaply'),
  filenamePattern: 'snaply-{yyyy}{MM}{dd}-{HH}{mm}{ss}',
  language: 'ko',
  theme: 'system',
  autoStart: false,
  afterCapture: 'editor',
  onboardingDone: false,
  savedRegions: []
})

let cached: AppSettings | null = null

/** 예전 기본 단축키 → 새 기본값 마이그레이션.
 * 사용자가 직접 바꾼 값은 유지하고, 구버전 기본값 그대로인 것만 새 기본값으로 교체한다.
 * (구 기본값이 OS 캡처와 충돌: Win PrtScn=화면 캡처, mac Cmd+Shift+3/4/5=시스템 스크린샷) */
function migrateLegacyHotkeys(s: AppSettings): void {
  const legacy: Record<keyof HotkeySettings, string[]> = {
    allInOne: ['PrintScreen', 'Command+Shift+9'],
    region: ['Control+Shift+R', 'Command+Shift+5'],
    fullscreen: ['Control+Shift+F', 'Command+Shift+3'],
    window: ['Control+Shift+W', 'Command+Shift+4'],
    record: ['Control+Shift+E', 'Command+Shift+8']
  }
  const fresh = defaults().hotkeys
  for (const key of Object.keys(legacy) as Array<keyof HotkeySettings>) {
    if (legacy[key].includes(s.hotkeys[key])) s.hotkeys[key] = fresh[key]
  }
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  if (cached) return cached
  try {
    if (existsSync(settingsPath())) {
      const loaded = JSON.parse(readFileSync(settingsPath(), 'utf-8'))
      const merged: AppSettings = { ...defaults(), ...loaded, hotkeys: { ...defaults().hotkeys, ...loaded.hotkeys } }
      migrateLegacyHotkeys(merged)
      cached = merged
      return merged
    }
  } catch {
    // 손상된 설정 파일이면 기본값으로 복구
  }
  cached = defaults()
  return cached
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const next: AppSettings = {
    ...getSettings(),
    ...patch,
    hotkeys: { ...getSettings().hotkeys, ...(patch.hotkeys ?? {}) }
  }
  cached = next
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}
