import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { installProtocolHandler, registerSchemes } from './protocol'
import { createTray } from './tray'
import { showWindow, closeAll, getWindow } from './windows'
import { registerCoreIpc } from './ipcHandlers'
import { startCapture } from './capture'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { getSettings } from './settings'
import { mkdirSync } from 'fs'

// 단일 인스턴스 보장
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showWindow('library')
  })

  registerSchemes()

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.snaply.app')
    installProtocolHandler()

    // 저장 폴더 준비
    mkdirSync(getSettings().savePath, { recursive: true })

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerCoreIpc()
    registerShortcuts()

    createTray({
      onCapture: (mode) => void startCapture({ mode }),
      onRecord: () => showWindow('recorder')
    })

    // 트레이 상주 앱: 첫 실행 시 보관함을 보여준다
    showWindow('library')

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) showWindow('library')
    })
  })

  // 트레이 상주: 모든 창이 닫혀도 종료하지 않는다
  app.on('window-all-closed', () => {
    // 기본 동작(app.quit)을 막아 트레이 상주 유지 — 종료는 트레이 메뉴에서
  })

  app.on('will-quit', () => {
    unregisterShortcuts()
  })

  app.on('before-quit', () => {
    // overlay 등 숨김 창까지 정리
    const lib = getWindow('library')
    if (lib && !lib.isDestroyed()) lib.removeAllListeners('close')
    closeAll()
  })
}
