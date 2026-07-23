import { app, clipboard, nativeImage, screen, shell } from 'electron'
import { readFileSync } from 'fs'
import { extname } from 'path'
import { handle } from './typedIpc'
import { getSettings, setSettings } from './settings'
import { broadcast, getWindow, sendTo, showWindow } from './windows'
import { registerCaptureIpc } from './capture'
import { registerLibraryIpc } from './library'
import { registerRecorderIpc } from './recorder'
import { registerExportIpc } from './export'
import { registerShareIpc } from './share'
import { applyAutoStart } from './autostart'
import { refreshTrayMenu } from './tray'
import { registerShortcuts } from './shortcuts'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
}

export function registerCoreIpc(): void {
  handle('app:getVersion', () => app.getVersion())

  handle('settings:get', () => getSettings())
  handle('settings:set', (patch) => {
    const prev = getSettings()
    const prevHotkeys = JSON.stringify(prev.hotkeys)
    const next = setSettings(patch)
    if (JSON.stringify(next.hotkeys) !== prevHotkeys) registerShortcuts()
    if (next.autoStart !== prev.autoStart) applyAutoStart(next.autoStart)
    if (
      next.language !== prev.language ||
      JSON.stringify(next.savedRegions ?? []) !== JSON.stringify(prev.savedRegions ?? [])
    ) {
      refreshTrayMenu()
    }
    broadcast('event:settingsChanged', next)
    return next
  })

  handle('window:open', ({ window, payload }) => {
    const win = showWindow(window)
    // 에디터 열기 + 항목 전달: payload에 {itemId, filePath}가 있으면 openInEditor 이벤트 전송
    if (window === 'editor' && payload && typeof payload === 'object' && 'filePath' in payload) {
      const item = payload as { itemId?: string; filePath: string }
      const send = (): void =>
        sendTo('editor', 'event:openInEditor', { itemId: item.itemId ?? '', filePath: item.filePath })
      if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
      else send()
    }
  })
  handle('window:close', (_p, event) => {
    const win = findSender(event)
    win?.close()
  })
  handle('window:minimize', (_p, event) => findSender(event)?.minimize())
  handle('window:maximize', (_p, event) => {
    const win = findSender(event)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  handle('clipboard:writeImage', ({ dataUrl, filePath }) => {
    const img = dataUrl ? nativeImage.createFromDataURL(dataUrl) : nativeImage.createFromPath(filePath!)
    clipboard.writeImage(img)
  })
  handle('clipboard:writeText', (text) => clipboard.writeText(text))

  handle('file:readDataUrl', (filePath) => {
    const mime = MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
    return `data:${mime};base64,${readFileSync(filePath).toString('base64')}`
  })
  handle('file:showInFolder', (filePath) => shell.showItemInFolder(filePath))

  handle('dialog:pickFolder', async ({ title, defaultPath }) => {
    const { dialog } = await import('electron')
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: title ?? '폴더 선택',
      defaultPath,
      properties: ['openDirectory', 'createDirectory']
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  handle('capture:listDisplays', () => {
    const primary = screen.getPrimaryDisplay()
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: d.label || `디스플레이 ${i + 1}`,
      bounds: d.bounds,
      scaleFactor: d.scaleFactor,
      isPrimary: d.id === primary.id
    }))
  })

  registerCaptureIpc()
  registerLibraryIpc()
  registerRecorderIpc()
  registerExportIpc()
  registerShareIpc()
}

function findSender(event: Electron.IpcMainInvokeEvent): Electron.BrowserWindow | undefined {
  for (const name of ['library', 'editor', 'overlay', 'recorder', 'settings'] as const) {
    const win = getWindow(name)
    if (win && win.webContents.id === event.sender.id) return win
  }
  return undefined
}
