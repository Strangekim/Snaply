import { app, net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { normalize } from 'path'
import { getSettings } from './settings'

/** app ready 이전에 호출해야 한다 */
export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'snaply-file',
      privileges: { standard: false, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false }
    }
  ])
}

/**
 * snaply-file://<encodeURIComponent(절대경로)> → 로컬 파일 서빙.
 * 허용 범위: 저장 폴더(savePath)와 userData 하위만 (경로 탈출 방지).
 */
export function installProtocolHandler(): void {
  protocol.handle('snaply-file', (request) => {
    const raw = decodeURIComponent(request.url.slice('snaply-file://'.length))
    const filePath = normalize(raw)
    const allowedRoots = [normalize(getSettings().savePath), normalize(app.getPath('userData'))]
    const ok = allowedRoots.some((root) => filePath.toLowerCase().startsWith(root.toLowerCase()))
    if (!ok) return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

/** 렌더러에서 쓸 URL 생성 (shared 유틸로 옮기지 않는 이유: main 전용) */
export function toSnaplyFileUrl(filePath: string): string {
  return `snaply-file://${encodeURIComponent(filePath)}`
}
