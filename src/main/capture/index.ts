import { desktopCapturer, globalShortcut, screen } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { handle } from '../typedIpc'
import { bus } from '../bus'
import { getSettings } from '../settings'
import {
  broadcast,
  ensureOverlayForDisplay,
  getOverlayWindows,
  pruneStaleOverlays,
  sendTo,
  sendToOverlays,
  showWindow
} from '../windows'
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
  const frames: Frame[] = []
  // 디스플레이마다 자기 물리 해상도로 getSources를 따로 호출한다.
  // (thumbnailSize는 모든 소스에 공통 적용되어, 유니온 최대 크기로 한 번에 받으면
  //  작은 모니터 프레임이 업스케일되어 화질이 뭉개진다. 정수 강제 — 비정수면 throw)
  for (let i = 0; i < displays.length; i++) {
    const display = displays[i]
    const w = Math.round(display.bounds.width * display.scaleFactor)
    const h = Math.round(display.bounds.height * display.scaleFactor)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: w, height: h }
    })
    // display_id는 문자열이며 screen API의 id와 매칭된다 (실패 시 인덱스 폴백)
    const source = sources.find((s) => String(display.id) === s.display_id) ?? sources[i] ?? sources[0]
    if (source) frames.push({ displayId: display.id, image: source.thumbnail })
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
    // 지연 캡처: 오버레이를 닫고 눈에 보이는 카운트다운 후 재진입.
    // 카운트다운 배지는 contentProtection으로 캡처에서 제외되고, 클릭은 아래 앱으로 통과된다
    closeOverlay()
    frozenFrames = new Map()
    startVisibleCountdown(options, delay)
    return
  }
  await beginCapture(options)
}

/** 카운트다운 중 등록한 글로벌 단축키(Space/Esc) 해제 */
function unregisterCountdownKeys(): void {
  try {
    globalShortcut.unregister('Space')
    globalShortcut.unregister('Escape')
  } catch {
    // 미등록 상태면 무시
  }
}

/**
 * 커서가 있는 디스플레이에 3-2-1 카운트다운을 표시한 뒤 캡처를 재시작한다.
 * - 캡처 예정 영역(지정 영역 또는 전체 화면)은 해당 디스플레이에 포커스 테두리로 계속 표시
 * - Space: 남은 시간과 무관하게 즉시 캡처 · Esc: 취소 (카운트다운 동안만 전역 등록)
 */
function startVisibleCountdown(options: CaptureOptions, delayMs: number): void {
  const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const badgeWin = ensureOverlayForDisplay(cursorDisplay)

  // 포커스 테두리: 지정 영역이 있으면 그 디스플레이에, 전체 화면 모드면 커서 디스플레이 전체에
  const displays = screen.getAllDisplays()
  const focusDisplay = options.region
    ? (displays.find((d) => d.id === options.region!.displayId) ?? cursorDisplay)
    : options.mode === 'fullscreen'
      ? cursorDisplay
      : null
  const focusWin = focusDisplay ? ensureOverlayForDisplay(focusDisplay) : null
  const focusRect = options.region
    ? { x: options.region.x, y: options.region.y, width: options.region.width, height: options.region.height }
    : focusDisplay
      ? { x: 0, y: 0, width: focusDisplay.bounds.width, height: focusDisplay.bounds.height }
      : null

  const wins = focusWin && focusWin !== badgeWin ? [badgeWin, focusWin] : [badgeWin]
  // 사용자가 카운트다운 동안 메뉴를 열 수 있도록 클릭을 통과시킨다 (포커스도 뺏지 않음)
  for (const w of wins) w.setIgnoreMouseEvents(true)

  let remaining = Math.max(1, Math.ceil(delayMs / 1000))
  let done = false

  const cleanup = (): void => {
    done = true
    if (pendingTimer) clearInterval(pendingTimer)
    pendingTimer = null
    unregisterCountdownKeys()
    for (const w of wins) {
      if (w.isDestroyed()) continue
      w.webContents.send('event:overlayCountdown', 0)
      w.webContents.send('event:overlayFocusRegion', null)
      w.setIgnoreMouseEvents(false)
      w.hide()
    }
  }

  const fire = (): void => {
    if (done) return
    cleanup()
    void finishDelayedCapture(options)
  }

  const cancel = (): void => {
    if (done) return
    cleanup()
    sessionOptions = null
    frozenFrames = new Map()
  }

  const begin = (): void => {
    badgeWin.webContents.send('event:overlayCountdown', remaining)
    if (focusWin && focusRect) focusWin.webContents.send('event:overlayFocusRegion', focusRect)
    for (const w of wins) {
      w.showInactive()
      w.moveTop()
    }
    badgeWin.setBounds(cursorDisplay.bounds)
    if (focusWin && focusDisplay && focusWin !== badgeWin) focusWin.setBounds(focusDisplay.bounds)

    // 카운트다운 동안만 전역 단축키: Space=즉시 캡처, Esc=취소
    try {
      globalShortcut.register('Space', fire)
      globalShortcut.register('Escape', cancel)
    } catch {
      // 등록 실패해도 카운트다운 자체는 진행
    }

    pendingTimer = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        fire()
      } else {
        badgeWin.webContents.send('event:overlayCountdown', remaining)
      }
    }, 1000)
  }
  const loading = wins.filter((w) => w.webContents.isLoading())
  if (loading.length > 0) {
    let waits = loading.length
    for (const w of loading) {
      w.webContents.once('did-finish-load', () => {
        waits -= 1
        if (waits === 0) begin()
      })
    }
  } else {
    begin()
  }
}

/**
 * 카운트다운 종료 후 처리:
 * - 영역이 이미 지정돼 있으면(region) 그 영역을 즉시 자동 캡처 (오버레이 재진입 없음)
 * - 전체 화면 + 대상 미지정이면 커서가 있는 모니터를 자동 캡처
 * - 그 외에는 캡처 오버레이를 다시 연다 (메뉴/툴팁 준비용 지연)
 */
async function finishDelayedCapture(options: CaptureOptions): Promise<void> {
  sessionOptions = options

  if (options.region) {
    await hideOverlayBeforeGrab()
    if (options.mode === 'scrolling') {
      frozenFrames = new Map()
      const { buffer, width, height } = await captureScrollingRegion(options.region, (p) =>
        broadcast('event:scrollProgress', p)
      )
      const result: CaptureResult = {
        id: randomUUID(),
        filePath: savePngBuffer(buffer),
        width,
        height,
        mode: 'scrolling',
        createdAt: Date.now()
      }
      await afterCapture(result, options)
      return
    }
    // 일반 영역: 지금 화면을 새로 찍어 지정 영역만 크롭
    const frames = await grabAllDisplayFrames()
    frozenFrames = new Map(frames.map((f) => [f.displayId, f.image]))
    const { buffer, width, height } = cropFrame(options.region)
    const result: CaptureResult = {
      id: randomUUID(),
      filePath: savePngBuffer(buffer),
      width,
      height,
      mode: 'region',
      createdAt: Date.now()
    }
    await afterCapture(result, options)
    return
  }

  if (options.mode === 'fullscreen' && options.displayId == null) {
    await hideOverlayBeforeGrab()
    frozenFrames = new Map()
    const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const result = await captureFullscreen(cursorDisplay.id)
    await afterCapture(result, options)
    return
  }

  await beginCapture(options)
}

/** 오버레이가 화면에 보이는 상태라면 숨기고, 컴포지터가 반영할 시간을 잠깐 기다린다 */
async function hideOverlayBeforeGrab(): Promise<void> {
  const visible = getOverlayWindows().filter((w) => w.isVisible())
  if (visible.length > 0) {
    sendToOverlays('event:overlayCancel', undefined)
    for (const win of visible) win.hide()
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
  const displays = screen.getAllDisplays()
  pruneStaleOverlays(displays.map((d) => d.id))
  const frames = await grabAllDisplayFrames()
  frozenFrames = new Map(frames.map((f) => [f.displayId, f.image]))

  // 캡슐(모드 전환 UI)은 커서가 있는 디스플레이에만 표시
  const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const primary = screen.getPrimaryDisplay()

  for (const display of displays) {
    const frame = frames.find((f) => f.displayId === display.id)
    if (!frame) continue
    const win = ensureOverlayForDisplay(display)
    const payload = {
      mode,
      frozenFrames: [{ displayId: display.id, dataUrl: frame.image.toDataURL() }],
      display: {
        id: display.id,
        label: display.label || '디스플레이',
        bounds: display.bounds,
        scaleFactor: display.scaleFactor,
        isPrimary: display.id === primary.id
      },
      showCapsule: display.id === cursorDisplay.id
    }
    const send = (): void => {
      win.webContents.send('event:overlayStart', payload)
      win.show()
      // show 직후 DPI 재조정으로 bounds가 어긋날 수 있어 한 번 더 강제한다
      win.setBounds(display.bounds)
      win.moveTop()
      if (display.id === cursorDisplay.id) win.focus()
    }
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
    else send()
  }
}

export function closeOverlay(): void {
  sendToOverlays('event:overlayCancel', undefined)
  sendToOverlays('event:overlayCountdown', 0)
  sendToOverlays('event:overlayFocusRegion', null)
  unregisterCountdownKeys()
  for (const win of getOverlayWindows()) {
    // 카운트다운 중 취소되더라도 클릭 통과 상태가 남지 않게 복구
    win.setIgnoreMouseEvents(false)
    if (win.isVisible()) win.hide()
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

  // 캡슐 모드 변경을 모든 오버레이 창에 동기화
  handle('overlay:setMode', (mode) => {
    sendToOverlays('event:overlayMode', mode)
  })

  // 선택 영역의 모니터 간 이동 동기화 (미리보기/핸드오프)
  handle('overlay:syncRect', (payload) => {
    sendToOverlays('event:overlayRect', payload)
  })

  // 고정 크기 배치 모드를 모든 오버레이 창에 동기화
  handle('overlay:armPreset', (size) => {
    sendToOverlays('event:overlayPreset', size)
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
