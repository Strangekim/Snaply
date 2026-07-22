import { globalShortcut } from 'electron'
import { getSettings } from '../settings'
import { startCapture } from '../capture'
import { showWindow } from '../windows'

/** 설정된 글로벌 단축키를 (재)등록한다 */
export function registerShortcuts(): void {
  globalShortcut.unregisterAll()
  const { hotkeys } = getSettings()

  const tryRegister = (accelerator: string, fn: () => void): void => {
    if (!accelerator) return
    try {
      globalShortcut.register(accelerator, fn)
    } catch {
      // 유효하지 않은 단축키 문자열은 무시 (설정 UI에서 검증)
    }
  }

  tryRegister(hotkeys.allInOne, () => void startCapture({ mode: 'all-in-one' }))
  tryRegister(hotkeys.region, () => void startCapture({ mode: 'region' }))
  tryRegister(hotkeys.fullscreen, () => void startCapture({ mode: 'fullscreen' }))
  tryRegister(hotkeys.window, () => void startCapture({ mode: 'window' }))
  tryRegister(hotkeys.record, () => showWindow('recorder'))
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
