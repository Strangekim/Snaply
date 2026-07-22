import { ipcMain } from 'electron'
import type { InvokeChannel, InvokeChannels } from '@shared/ipc'

/** 타입 세이프 ipcMain.handle 래퍼 — 계약(shared/ipc.ts)에 정의된 채널만 등록 가능 */
export function handle<C extends InvokeChannel>(
  channel: C,
  handler: (
    payload: InvokeChannels[C]['req'],
    event: Electron.IpcMainInvokeEvent
  ) => Promise<InvokeChannels[C]['res']> | InvokeChannels[C]['res']
): void {
  ipcMain.handle(channel, (event, payload) => handler(payload, event))
}
