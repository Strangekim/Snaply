import { desktopCapturer, screen } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { handle } from '../typedIpc'
import { bus } from '../bus'
import { getSettings } from '../settings'
import { broadcast, ensureWindow, getWindow, sendTo, showWindow } from '../windows'
import { captureScrollingRegion } from './scrolling'
import type { CaptureMode, CaptureOptions, CaptureResult, RegionRect } from '@shared/ipc'
import { formatFilename } from '@shared/filename'

// ─────────────── 파일 저장 유틸 ───────────────

export function buildFileName(ext: string): string {
  return `${formatFilename(getSettings().filenamePattern, new Date())}.${ext}`
}

export function savePngBuffer(buf: Buffer): string {
  const dir = getSettings().savePath
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, buildFileName('png'))
  writeFileSync(filePath, buf)
  return filePath
}

// ─────────────── 화면 프레임 획득 ───────────────

interface Frame {
  displayId: number
  image: Electron.NativeImage
}

async function grabAllDisplayFrames(): Promise<Frame[]> {
  const displays = screen.getAllDisplays()
  // thumbnailSize는 정수여야 한다 — scaleFactor 1.5 × 홀수 해상도면 비정수가 되어 getSources가 throw
  const maxW = Math.round(Math.max(...displays.map((d) => d.bounds.width * d.scaleFactor)))
  const maxH = Math.round(Math.max(...displays.map((d) => d.bounds.height * d.scaleFactor)))
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: maxW, height: maxH }
  })
  const frames: Frame[] = []
  for (const source of sources) {
    // display_id는 문자열이며 screen API의 id와 매칭된다
    const display =
      displays.find((d) => String(d.id) === source.display_id) ??
      displays[sources.indexOf(source)] ??
      displays[0]
    frames.push({ displayId: display.id, image: source.thumbnail })
  }
  return frames
}

async function grabDisplayFrame(displayId: number): Promise<Frame> {
  const frames = await grabAllDisplayFrames()
  return frames.find((f) => f.displayId === displayId) ?? frames[0]
}

// ─────────────── 캡처 플로우 ───────────────

let pendingTimer: NodeJS.Timeout | null = null

/** 현재 캡처 세션의 옵션 — 오버레이 커밋(commitRegion 등) 시 afterAction 등을 이어받기 위해 보관 */
let sessionOptions: CaptureOptions | null = null

export async function startCapture(options: CaptureOptions): Promise<void> {
  const delay = options.scheduledAt ? Math.max(0, options.scheduledAt - Date.now()) : (options.delayMs ?? 0)
  if (pendingTimer) {
    clearTimeout(pendingTimer)
    pendingTimer = null
  }
  if (delay > 0) {
    // 지연 캡처: 열려 있던 오버레이를 먼저 닫은 뒤 카운트다운 시작.
    // (오버레이가 떠 있는 채로 카운트하면 지연 후 프리즈 프레임에 오버레이가 함께 찍힌다)
    closeOverlay()
    frozenFrames = new Map()
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      void beginCapture(options)
    }, delay)
    return
  }
  await beginCapture(options)
}

/** 오버레이가 화면에 보이는 상태라면 숨기고, 컴포지터가 반영할 시간을 잠깐 기다린다 */
async function hideOverlayBeforeGrab(): Promise<void> {
  const win = getWindow('overlay')
  if (win && win.isVisible()) {
    sendTo('overlay', 'event:overlayCancel', undefined)
    win.hide()
    await new Promise((resolve) => setTimeout(resolve, 180))
  }
}

async function beginCapture(options: CaptureOptions): Promise<void> {
  sessionOptions = options
  if (options.mode === 'fullscreen') {
    const displays = screen.getAllDisplays()
    if (displays.length === 1 || options.displayId != null) {
      // 이전 세션의 프리즈 프레임이 남아 있으면 지금 화면과 다르므로 새로 획득
      await hideOverlayBeforeGrab()
      frozenFrames = new Map()
      const id = options.displayId ?? displays[0].id
      const result = await captureFullscreen(id)
      await afterCapture(result, options)
      return
    }
    // 멀티 모니터 + 대상 미지정 → 오버레이에서 모니터 선택
  }
  await openOverlay(options.mode)
}

async function openOverlay(mode: CaptureMode): Promise<void> {
  // 오버레이를 띄우기 전에 화면을 프리즈(현재 프레임 캡처)
  await hideOverlayBeforeGrab()
  const frames = await grabAllDisplayFrames()
  const frozen = frames.map((f) => ({ displayId: f.displayId, dataUrl: f.image.toDataURL() }))
  frozenFrames = new Map(frames.map((f) => [f.displayId, f.image]))

  const win = ensureWindow('overlay')
  const send = (): void => {
    sendTo('overlay', 'event:overlayStart', { mode, frozenFrames: frozen })
    win.show()
    win.focus()
  }
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', send)
  } else {
    send()
  }
}

export function closeOverlay(): void {
  const win = getWindow('overlay')
  if (win) {
    sendTo('overlay', 'event:overlayCancel', undefined)
    win.hide()
  }
}

/** 오버레이가 떠 있는 동안 프리즈된 원본 프레임 (displayId → NativeImage) */
let frozenFrames = new Map<number, Electron.NativeImage>()

async function captureFullscreen(displayId: number): Promise<CaptureResult> {
  const frame = frozenFrames.get(displayId) ?? (await grabDisplayFrame(displayId)).image
  const size = frame.getSize()
  const filePath = savePngBuffer(frame.toPNG())
  return {
    id: randomUUID(),
    filePath,
    width: size.width,
    height: size.height,
    mode: 'fullscreen',
    createdAt: Date.now()
  }
}

function cropFrame(rect: RegionRect): { buffer: Buffer; width: number; height: number } {
  const frame = frozenFrames.get(rect.displayId)
  if (!frame) throw new Error('프리즈된 프레임이 없어요. 캡처를 다시 시작해 주세요.')
  const display = screen.getAllDisplays().find((d) => d.id === rect.displayId)
  const frameSize = frame.getSize()
  // DPI 대응: rect는 DIP 좌표, 프레임은 물리 픽셀일 수 있다.
  // scaleFactor를 그대로 쓰지 않고 "실제 프레임 크기 / 디스플레이 DIP 크기"를 축별로 계산해
  // desktopCapturer가 썸네일을 임의 배율로 맞춰 반환하는 경우(scaleFactor≠1 포함)에도 정확히 크롭한다.
  const scaleX = display ? frameSize.width / display.bounds.width : 1
  const scaleY = display ? frameSize.height / display.bounds.height : 1
  const x = Math.min(Math.max(0, Math.round(rect.x * scaleX)), frameSize.width - 1)
  const y = Math.min(Math.max(0, Math.round(rect.y * scaleY)), frameSize.height - 1)
  const width = Math.max(1, Math.min(Math.round(rect.width * scaleX), frameSize.width - x))
  const height = Math.max(1, Math.min(Math.round(rect.height * scaleY), frameSize.height - y))
  const cropped = frame.crop({ x, y, width, height })
  const size = cropped.getSize()
  return { buffer: cropped.toPNG(), width: size.width, height: size.height }
}

/** 창 제목에서 앱 이름 추정.
 * Windows의 desktopCapturer source name은 보통 "문서 이름 - 앱 이름" 형태라 마지막 구분자 뒤를 앱 이름으로 사용한다.
 * TODO(platform-verify): macOS는 창 제목에 앱 이름이 붙지 않는 경우가 많아(owning application 정보 미제공) 별도 API 검증 필요 */
function inferAppName(title: string): string | undefined {
  for (const sep of [' - ', ' — ', ' – ']) {
    const idx = title.lastIndexOf(sep)
    if (idx > 0 && idx + sep.length < title.length) {
      const candidate = title.slice(idx + sep.length).trim()
      if (candidate.length > 0 && candidate.length <= 40) return candidate
    }
  }
  return undefined
}

async function afterCapture(result: CaptureResult, options?: CaptureOptions): Promise<void> {
  frozenFrames = new Map()
  sessionOptions = null
  closeOverlay()
  bus.emit('captureCompleted', result)
  broadcast('event:captureCompleted', result)

  const action = options?.afterAction ?? getSettings().afterCapture
  if (action === 'clipboard') {
    const { clipboard, nativeImage } = await import('electron')
    clipboard.writeImage(nativeImage.createFromPath(result.filePath))
  } else if (action === 'editor') {
    const editor = showWindow('editor')
    const send = (): void => sendTo('editor', 'event:openInEditor', { itemId: result.id, filePath: result.filePath })
    if (editor.webContents.isLoading()) editor.webContents.once('did-finish-load', send)
    else send()
  }
}

// ─────────────── IPC 등록 ───────────────

export function registerCaptureIpc(): void {
  // 에러를 삼키지 않고 IPC reject로 전달한다 (렌더러가 실패를 알 수 있게)
  handle('capture:start', (options) => startCapture(options))
  handle('capture:cancel', () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    frozenFrames = new Map()
    sessionOptions = null
    closeOverlay()
  })

  handle('capture:commitRegion', async (rect) => {
    const { buffer, width, height } = cropFrame(rect)
    const filePath = savePngBuffer(buffer)
    const result: CaptureResult = {
      id: randomUUID(),
      filePath,
      width,
      height,
      mode: 'region',
      createdAt: Date.now()
    }
    await afterCapture(result, sessionOptions ?? undefined)
    return result
  })

  handle('capture:commitFullscreen', async ({ displayId }) => {
    const result = await captureFullscreen(displayId)
    await afterCapture(result, sessionOptions ?? undefined)
    return result
  })

  handle('capture:commitWindow', async ({ sourceId, title, appName }) => {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 3840, height: 2160 }
    })
    const source = sources.find((s) => s.id === sourceId)
    if (!source) throw new Error('창을 찾지 못했어요. 다시 시도해 주세요.')
    const size = source.thumbnail.getSize()
    const filePath = savePngBuffer(source.thumbnail.toPNG())
    const result: CaptureResult = {
      id: randomUUID(),
      filePath,
      width: size.width,
      height: size.height,
      mode: 'window',
      createdAt: Date.now(),
      sourceTitle: title ?? source.name,
      sourceApp: appName ?? inferAppName(title ?? source.name)
    }
    await afterCapture(result, sessionOptions ?? undefined)
    return result
  })

  handle('capture:listWindows', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 480, height: 320 },
      fetchWindowIcons: true
    })
    return sources
      .filter((s) => s.name && !s.name.startsWith('Snaply') && s.thumbnail && !s.thumbnail.isEmpty())
      .map((s) => ({
        sourceId: s.id,
        title: s.name,
        appName: inferAppName(s.name),
        thumbnailDataUrl: s.thumbnail.toDataURL()
      }))
  })

  handle('capture:scrolling:start', async (rect) => {
    // afterCapture가 sessionOptions를 비우므로 미리 보관
    const options = sessionOptions
    // 자동 스크롤 대상은 실제 화면이어야 하므로 오버레이를 먼저 숨긴다
    await hideOverlayBeforeGrab()
    frozenFrames = new Map()
    // TODO(Phase 3): 진행 중 소형 진행 UI — 현재는 event:scrollProgress 브로드캐스트만 하고
    // 수신해 표시하는 창이 없다. recorder 창과 별개의 미니 창에서 구독해 표시할 것.
    const { buffer, width, height } = await captureScrollingRegion(rect, (p) =>
      broadcast('event:scrollProgress', p)
    )
    const filePath = savePngBuffer(buffer)
    const result: CaptureResult = {
      id: randomUUID(),
      filePath,
      width,
      height,
      mode: 'scrolling',
      createdAt: Date.now()
    }
    await afterCapture(result, options ?? undefined)
    return result
  })
}
