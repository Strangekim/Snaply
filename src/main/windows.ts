import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { EventChannel, EventChannels } from '@shared/ipc'

export type WindowName = 'library' | 'editor' | 'overlay' | 'recorder' | 'settings'

const windows = new Map<WindowName, BrowserWindow>()

function pageUrl(name: WindowName): { url?: string; file?: string } {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return { url: `${process.env['ELECTRON_RENDERER_URL']}/${name}.html` }
  }
  return { file: join(__dirname, `../renderer/${name}.html`) }
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
  overlay: () => {
    // 모든 디스플레이를 덮는 가상 영역
    const displays = screen.getAllDisplays()
    const minX = Math.min(...displays.map((d) => d.bounds.x))
    const minY = Math.min(...displays.map((d) => d.bounds.y))
    const maxX = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width))
    const maxY = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height))
    return {
      ...baseOptions(),
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
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
  },
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
