import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { EventChannel, EventChannels } from '@shared/ipc'

export type WindowName = 'library' | 'editor' | 'overlay' | 'recorder' | 'settings'

/** 오버레이는 디스플레이당 1개('overlay:<displayId>') — 혼합 DPI에서 스팬 창이 잘리는 문제 회피 */
const windows = new Map<string, BrowserWindow>()

function pageUrl(name: WindowName): { url?: string; file?: string } {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return { url: `${process.env['ELECTRON_RENDERER_URL']}/${name}.html` }
  }
  return { file: join(__dirname, `../renderer/${name}.html`) }
}

/** 특정 디스플레이 하나를 정확히 덮는 오버레이 창 옵션 */
function overlayOptions(display: Electron.Display): Electron.BrowserWindowConstructorOptions {
  return {
    ...baseOptions(),
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    hasShadow: false,
    enableLargerThanScreen: true
  }
}

function baseOptions(): Electron.BrowserWindowConstructorOptions {
  return {
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  }
}

const configs: Record<WindowName, () => Electron.BrowserWindowConstructorOptions> = {
  library: () => ({
    ...baseOptions(),
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Snaply',
    backgroundColor: '#F9FAFB'
  }),
  editor: () => ({
    ...baseOptions(),
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Snaply 에디터',
    backgroundColor: '#F9FAFB'
  }),
  overlay: () => overlayOptions(screen.getPrimaryDisplay()),
  recorder: () => ({
    ...baseOptions(),
    width: 420,
    height: 72,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'Snaply 녹화'
  }),
  settings: () => ({
    ...baseOptions(),
    width: 720,
    height: 640,
    minWidth: 600,
    minHeight: 500,
    title: 'Snaply 설정',
    backgroundColor: '#F9FAFB'
  })
}

export function getWindow(name: WindowName): BrowserWindow | undefined {
  const win = windows.get(name)
  return win && !win.isDestroyed() ? win : undefined
}

// ───────────── 디스플레이별 오버레이 창 ─────────────

export function ensureOverlayForDisplay(display: Electron.Display): BrowserWindow {
  const key = `overlay:${display.id}`
  const existing = windows.get(key)
  if (existing && !existing.isDestroyed()) {
    existing.setBounds(display.bounds)
    return existing
  }
  const win = new BrowserWindow(overlayOptions(display))
  // 생성 시점에는 OS가 workArea/DPI에 맞춰 크기를 잘라버린다 (예: 960→912, 혼합 DPI 모니터는 완전히 어긋남).
  // 생성 후 setBounds를 다시 호출하면 정확한 전체 화면 크기가 적용된다.
  win.setBounds(display.bounds)
  // 기본 'floating' 레벨은 포커스 이동 시 다른 창 아래로 내려갈 수 있다 — 캡처 오버레이는 항상 최상단
  win.setAlwaysOnTop(true, 'screen-saver')
  win.on('blur', () => {
    // 팝오버 입력 등으로 포커스가 흔들려도 오버레이가 뒤로 밀리지 않게 유지
    if (!win.isDestroyed() && win.isVisible()) win.moveTop()
  })
  windows.set(key, win)
  win.on('closed', () => windows.delete(key))
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  const target = pageUrl('overlay')
  if (target.url) void win.loadURL(target.url)
  else if (target.file) void win.loadFile(target.file)
  return win
}

export function getOverlayWindows(): BrowserWindow[] {
  const result: BrowserWindow[] = []
  for (const [key, win] of windows) {
    if (key.startsWith('overlay') && !win.isDestroyed()) result.push(win)
  }
  return result
}

/** 현재 디스플레이 구성에 없는 오버레이 창 정리 (모니터 연결 해제 대응) */
export function pruneStaleOverlays(validDisplayIds: number[]): void {
  const valid = new Set(validDisplayIds.map((id) => `overlay:${id}`))
  for (const [key, win] of windows) {
    if (key.startsWith('overlay:') && !valid.has(key) && !win.isDestroyed()) {
      win.destroy()
      windows.delete(key)
    }
  }
}

export function sendToOverlays<C extends EventChannel>(channel: C, payload: EventChannels[C]): void {
  for (const win of getOverlayWindows()) win.webContents.send(channel, payload)
}

export function ensureWindow(name: WindowName): BrowserWindow {
  const existing = getWindow(name)
  if (existing) return existing

  const win = new BrowserWindow(configs[name]())
  windows.set(name, win)

  win.on('closed', () => windows.delete(name))
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const target = pageUrl(name)
  if (target.url) void win.loadURL(target.url)
  else if (target.file) void win.loadFile(target.file)

  return win
}

export function showWindow(name: WindowName): BrowserWindow {
  const win = ensureWindow(name)
  if (name !== 'overlay') {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
  return win
}

/** 특정 창에 타입 세이프 이벤트 전송 */
export function sendTo<C extends EventChannel>(name: WindowName, channel: C, payload: EventChannels[C]): void {
  const win = getWindow(name)
  if (win) win.webContents.send(channel, payload)
}

/** 모든 창에 브로드캐스트 */
export function broadcast<C extends EventChannel>(channel: C, payload: EventChannels[C]): void {
  for (const [, win] of windows) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function closeAll(): void {
  for (const [, win] of windows) {
    if (!win.isDestroyed()) win.destroy()
  }
  windows.clear()
}
