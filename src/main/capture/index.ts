import { desktopCapturer, screen } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { handle } from '../typedIpc'
import { getSettings } from '../settings'
import { broadcast, ensureWindow, getWindow, sendTo, showWindow } from '../windows'
import type { CaptureMode, CaptureOptions, CaptureResult, RegionRect } from '@shared/ipc'

// ─────────────── 파일 저장 유틸 ───────────────

export function buildFileName(ext: string): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const pattern = getSettings().filenamePattern || 'snaply-{yyyy}{MM}{dd}-{HH}{mm}{ss}'
  const name = pattern
    .replace('{yyyy}', String(now.getFullYear()))
    .replace('{MM}', pad(now.getMonth() + 1))
    .replace('{dd}', pad(now.getDate()))
    .replace('{HH}', pad(now.getHours()))
    .replace('{mm}', pad(now.getMinutes()))
    .replace('{ss}', pad(now.getSeconds()))
  return `${name}.${ext}`
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
  const maxW = Math.max(...displays.map((d) => d.bounds.width * d.scaleFactor))
  const maxH = Math.max(...displays.map((d) => d.bounds.height * d.scaleFactor))
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

export async function startCapture(options: CaptureOptions): Promise<void> {
  const delay = options.scheduledAt ? Math.max(0, options.scheduledAt - Date.now()) : (options.delayMs ?? 0)
  if (pendingTimer) {
    clearTimeout(pendingTimer)
    pendingTimer = null
  }
  if (delay > 0) {
    pendingTimer = setTimeout(() => void beginCapture(options), delay)
    return
  }
  await beginCapture(options)
}

async function beginCapture(options: CaptureOptions): Promise<void> {
  if (options.mode === 'fullscreen') {
    const displays = screen.getAllDisplays()
    if (displays.length === 1 || options.displayId != null) {
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
  const scale = display ? frame.getSize().width / display.bounds.width : 1
  const cropped = frame.crop({
    x: Math.round(rect.x * scale),
    y: Math.round(rect.y * scale),
    width: Math.round(rect.width * scale),
    height: Math.round(rect.height * scale)
  })
  const size = cropped.getSize()
  return { buffer: cropped.toPNG(), width: size.width, height: size.height }
}

async function afterCapture(result: CaptureResult, options?: CaptureOptions): Promise<void> {
  frozenFrames = new Map()
  closeOverlay()
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
  handle('capture:start', (options) => void startCapture(options))
  handle('capture:cancel', () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    frozenFrames = new Map()
    closeOverlay()
  })

  handle('capture:getFrozenFrame', async ({ displayId }) => {
    const frame = frozenFrames.get(displayId) ?? (await grabDisplayFrame(displayId)).image
    return { dataUrl: frame.toDataURL(), displayId }
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
    await afterCapture(result)
    return result
  })

  handle('capture:commitFullscreen', async ({ displayId }) => {
    const result = await captureFullscreen(displayId)
    await afterCapture(result)
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
      sourceApp: appName
    }
    await afterCapture(result)
    return result
  })

  handle('capture:listWindows', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 480, height: 320 },
      fetchWindowIcons: true
    })
    return sources
      .filter((s) => s.name && s.name !== 'Snaply')
      .map((s) => ({
        sourceId: s.id,
        title: s.name,
        appName: undefined,
        thumbnailDataUrl: s.thumbnail.toDataURL()
      }))
  })

  handle('capture:scrolling:start', async () => {
    // Phase 2에서 구현 (스티칭)
    throw new Error('스크롤 캡처는 아직 준비 중이에요.')
  })
}
