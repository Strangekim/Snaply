import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'path'
import { showWindow } from '../windows'
import { getSettings } from '../settings'

let tray: Tray | null = null
let savedHandlers: TrayHandlers | null = null

interface TrayHandlers {
  onCapture: (mode: 'region' | 'window' | 'fullscreen' | 'all-in-one') => void
  onRecord: () => void
}

/** 트레이 메뉴 문구 (ko/en) */
const LABELS = {
  ko: {
    tooltip: 'Snaply — 화면 캡처',
    capture: '캡처하기',
    region: '영역 캡처',
    window: '창 캡처',
    fullscreen: '전체 화면 캡처',
    record: '화면 녹화',
    library: '보관함 열기',
    settings: '설정',
    quit: '종료'
  },
  en: {
    tooltip: 'Snaply — Screen capture',
    capture: 'Capture',
    region: 'Region capture',
    window: 'Window capture',
    fullscreen: 'Full screen capture',
    record: 'Screen recording',
    library: 'Open library',
    settings: 'Settings',
    quit: 'Quit'
  }
} as const

function buildMenu(handlers: TrayHandlers): void {
  if (!tray) return
  const lang = getSettings().language
  const L = LABELS[lang] ?? LABELS.ko
  tray.setToolTip(L.tooltip)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: L.capture, click: () => handlers.onCapture('all-in-one') },
      { label: L.region, click: () => handlers.onCapture('region') },
      { label: L.window, click: () => handlers.onCapture('window') },
      { label: L.fullscreen, click: () => handlers.onCapture('fullscreen') },
      { type: 'separator' },
      { label: L.record, click: () => handlers.onRecord() },
      { type: 'separator' },
      { label: L.library, click: () => showWindow('library') },
      { label: L.settings, click: () => showWindow('settings') },
      { type: 'separator' },
      { label: L.quit, click: () => app.quit() }
    ])
  )
}

export function createTray(handlers: TrayHandlers): Tray {
  const iconPath = join(__dirname, '../../resources/icon-32.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  savedHandlers = handlers
  buildMenu(handlers)
  tray.on('double-click', () => showWindow('library'))
  return tray
}

/** 언어 변경 시 메뉴 재구성 (ipcHandlers의 settings:set에서 호출) */
export function refreshTrayMenu(): void {
  if (savedHandlers) buildMenu(savedHandlers)
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
  savedHandlers = null
}
