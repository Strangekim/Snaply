import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'path'
import { showWindow } from '../windows'

let tray: Tray | null = null

export function createTray(handlers: {
  onCapture: (mode: 'region' | 'window' | 'fullscreen' | 'all-in-one') => void
  onRecord: () => void
}): Tray {
  const iconPath = join(__dirname, '../../resources/icon-32.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Snaply — 화면 캡처')

  const menu = Menu.buildFromTemplate([
    { label: '캡처하기', click: () => handlers.onCapture('all-in-one') },
    { label: '영역 캡처', click: () => handlers.onCapture('region') },
    { label: '창 캡처', click: () => handlers.onCapture('window') },
    { label: '전체 화면 캡처', click: () => handlers.onCapture('fullscreen') },
    { type: 'separator' },
    { label: '화면 녹화', click: () => handlers.onRecord() },
    { type: 'separator' },
    { label: '보관함 열기', click: () => showWindow('library') },
    { label: '설정', click: () => showWindow('settings') },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
  tray.on('double-click', () => showWindow('library'))
  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
