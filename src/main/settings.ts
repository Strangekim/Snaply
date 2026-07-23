import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '@shared/ipc'

const defaults = (): AppSettings => ({
  hotkeys: {
    allInOne:
      process.platform === 'darwin' ? 'Command+Shift+9' : 'PrintScreen',
    region: process.platform === 'darwin' ? 'Command+Shift+5' : 'Control+Shift+R',
    fullscreen: process.platform === 'darwin' ? 'Command+Shift+3' : 'Control+Shift+F',
    window: process.platform === 'darwin' ? 'Command+Shift+4' : 'Control+Shift+W',
    record: process.platform === 'darwin' ? 'Command+Shift+8' : 'Control+Shift+E'
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

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  if (cached) return cached
  try {
    if (existsSync(settingsPath())) {
      const loaded = JSON.parse(readFileSync(settingsPath(), 'utf-8'))
      const merged: AppSettings = { ...defaults(), ...loaded, hotkeys: { ...defaults().hotkeys, ...loaded.hotkeys } }
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
