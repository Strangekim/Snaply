import { contextBridge, ipcRenderer } from 'electron'
import type { SnaplyApi } from '@shared/ipc'

const api: SnaplyApi = {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on: (channel, listener) => {
    const wrapped = (_e: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      ;(listener as (payload: unknown) => void)(args[0])
    }
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('snaply', api)
