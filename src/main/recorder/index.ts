/**
 * 화면 녹화 메인 모듈. 소유자: Recorder (Phase 3).
 * - setDisplayMediaRequestHandler: 렌더러 getDisplayMedia에 desktopCapturer 소스 공급
 * - record:* IPC + event:recordState 브로드캐스트 (녹화 상태 머신의 메인측 절반)
 * - recorder 창 크기 상태 전환 (설정 카드 ↔ 투명 풀스크린 ↔ 컨트롤 캡슐)
 * - record:finalize: WebM → MP4/GIF 변환 (ffmpeg-static), 트리밍/crop
 */
import { app, desktopCapturer, screen, session, type BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import ffmpegStaticPath from 'ffmpeg-static'
import { handle } from '../typedIpc'
import { bus } from '../bus'
import { getSettings } from '../settings'
import { broadcast, getWindow } from '../windows'
import { buildFileName } from '../capture'
import { buildFfmpegCommands, regionToCrop, type CropRect } from './ffmpegArgs'
import type { RecordOptions, RecordResult } from '@shared/ipc'

// ─────────────── 창 크기 상수 ───────────────

/** 설정 카드/트리밍 프리뷰 패널 크기 */
const PANEL = { width: 440, height: 660 }
/** 녹화 중 컨트롤 캡슐 크기 (windows.ts 초기값과 동일) */
const CAPSULE = { width: 420, height: 72 }
/** 카운트다운 총 시간 — 렌더러의 3-2-1 애니메이션(3초)과 맞춘 여유값 */
const COUNTDOWN_MS = 3200
/** 녹화 경과 시간 브로드캐스트 주기 */
const TICK_MS = 250

// ─────────────── 상태 ───────────────

type RecorderState = 'idle' | 'selecting' | 'countdown' | 'recording' | 'paused' | 'processing'

let state: RecorderState = 'idle'
let currentOptions: RecordOptions | null = null
let countdownTimer: NodeJS.Timeout | null = null
let tickTimer: NodeJS.Timeout | null = null
/** 일시정지 이전까지 누적된 녹화 시간 */
let accumulatedMs = 0
/** 마지막 재개 시각 (recording 상태일 때만 유효) */
let resumedAt = 0
/** 정지 시점에 확정된 총 녹화 시간 — finalize 결과의 durationMs 기본값 */
let lastDurationMs = 0

function elapsedMs(): number {
  return state === 'recording' ? accumulatedMs + (Date.now() - resumedAt) : accumulatedMs
}

function sendState(
  s: 'idle' | 'countdown' | 'recording' | 'paused' | 'processing',
  elapsed?: number
): void {
  broadcast('event:recordState', elapsed == null ? { state: s } : { state: s, elapsedMs: elapsed })
}

function clearTimers(): void {
  if (countdownTimer) {
    clearTimeout(countdownTimer)
    countdownTimer = null
  }
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

// ─────────────── 창 배치 ───────────────

function displayFor(id?: number): Electron.Display {
  if (id != null) {
    const found = screen.getAllDisplays().find((d) => d.id === id)
    if (found) return found
  }
  return screen.getPrimaryDisplay()
}

function targetDisplay(): Electron.Display {
  return displayFor(currentOptions?.region?.displayId ?? currentOptions?.displayId)
}

/** resizable:false 창도 확실히 리사이즈되도록 잠시 풀었다가 되돌린다 */
function setBoundsForced(win: BrowserWindow, bounds: Electron.Rectangle): void {
  const wasResizable = win.isResizable()
  win.setResizable(true)
  win.setBounds(bounds)
  win.setResizable(wasResizable)
}

/** 설정 카드/프리뷰 패널 — 대상 디스플레이 중앙 */
function toPanel(win: BrowserWindow, display: Electron.Display): void {
  const area = display.workArea
  setBoundsForced(win, {
    x: Math.round(area.x + (area.width - PANEL.width) / 2),
    y: Math.round(area.y + (area.height - PANEL.height) / 2),
    ...PANEL
  })
}

/** 투명 풀스크린 — 영역 드래그 선택·카운트다운용 */
function toFullscreen(win: BrowserWindow, display: Electron.Display): void {
  setBoundsForced(win, display.bounds)
}

/** 녹화 중 컨트롤 캡슐 — 화면 하단 중앙 */
function toCapsule(win: BrowserWindow, display: Electron.Display): void {
  const area = display.workArea
  setBoundsForced(win, {
    x: Math.round(area.x + (area.width - CAPSULE.width) / 2),
    y: Math.round(area.y + area.height - CAPSULE.height - 24),
    ...CAPSULE
  })
}

// ─────────────── 상태 전환 ───────────────

function resetToIdle(resize: boolean): void {
  clearTimers()
  const display = targetDisplay()
  state = 'idle'
  accumulatedMs = 0
  if (resize) {
    const win = getWindow('recorder')
    if (win) toPanel(win, display)
  }
}

function beginCountdown(options: RecordOptions): void {
  clearTimers()
  currentOptions = options
  state = 'countdown'
  const win = getWindow('recorder')
  const display = targetDisplay()
  if (win) toFullscreen(win, display)
  sendState('countdown')

  countdownTimer = setTimeout(() => {
    countdownTimer = null
    state = 'recording'
    accumulatedMs = 0
    resumedAt = Date.now()
    if (win && !win.isDestroyed()) toCapsule(win, display)
    sendState('recording', 0)
    tickTimer = setInterval(() => sendState('recording', elapsedMs()), TICK_MS)
  }, COUNTDOWN_MS)
}

/**
 * recorder 창이 만들어지면 준비 작업을 한다.
 * - setContentProtection: 캡슐/카운트다운 UI가 녹화 결과에 찍히지 않도록 캡처에서 제외
 * - 설정 카드 크기(PANEL)로 확대 — 계약에 창 리사이즈 채널이 없어 창 생성 이벤트로 우회
 * TODO(contract): 전용 window:setBounds 채널이 생기면 이 훅은 제거 (Architect 승인 필요)
 */
function prepareRecorderWindow(win: BrowserWindow): void {
  try {
    win.setContentProtection(true)
  } catch {
    // TODO(platform-verify): 일부 플랫폼에서 미지원 — 실패해도 녹화는 계속
  }
  toPanel(win, screen.getDisplayNearestPoint(screen.getCursorScreenPoint()))
  win.on('closed', () => {
    // 녹화 도중 창이 닫히면 스트림도 함께 죽으므로 메인 상태를 정리한다
    resetToIdle(false)
    currentOptions = null
    sendState('idle')
  })
}

// ─────────────── ffmpeg 실행 ───────────────

function resolveFfmpegPath(): string {
  const p = ffmpegStaticPath
  if (!p) throw new Error('ffmpeg 실행 파일을 찾지 못했어요.')
  // 패키징 시 asar 밖으로 풀린 경로를 사용
  return p.replace('app.asar', 'app.asar.unpacked')
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveFfmpegPath(), args, { windowsHide: true })
    let stderrTail = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-4000)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg 변환에 실패했어요 (code ${code}).\n${stderrTail}`))
    })
  })
}

function decodeDataUrl(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('잘못된 dataURL이에요.')
  return Buffer.from(dataUrl.slice(comma + 1), 'base64')
}

function computeCrop(): CropRect | undefined {
  const region = currentOptions?.mode === 'region' ? currentOptions.region : undefined
  if (!region) return undefined
  // DIP → 물리 픽셀: 대상 디스플레이 scaleFactor 사용
  const display = displayFor(region.displayId)
  return regionToCrop(region, display.scaleFactor)
}

async function finalizeRecording(req: {
  webmDataUrl: string
  format: 'mp4' | 'gif'
  trimStartMs?: number
  trimEndMs?: number
  fps?: number
}): Promise<RecordResult> {
  state = 'processing'
  sendState('processing')

  const tmpDir = join(app.getPath('temp'), 'snaply-record')
  mkdirSync(tmpDir, { recursive: true })
  const stamp = Date.now()
  const input = join(tmpDir, `rec-${stamp}.webm`)
  const palettePath = join(tmpDir, `palette-${stamp}.png`)

  try {
    writeFileSync(input, decodeDataUrl(req.webmDataUrl))

    const outDir = getSettings().savePath
    mkdirSync(outDir, { recursive: true })
    const output = join(outDir, buildFileName(req.format))

    const commands = buildFfmpegCommands({
      input,
      output,
      format: req.format,
      fps: req.fps,
      trimStartMs: req.trimStartMs,
      trimEndMs: req.trimEndMs,
      crop: computeCrop(),
      palettePath
    })
    for (const args of commands) await runFfmpeg(args)

    const start = req.trimStartMs ?? 0
    const end = req.trimEndMs ?? lastDurationMs
    const durationMs = Math.max(0, Math.min(end, lastDurationMs || end) - start)

    const result: RecordResult = {
      id: randomUUID(),
      filePath: output,
      durationMs: durationMs || lastDurationMs,
      format: req.format
    }
    // 보관함 등록은 Library 모듈이 bus를 구독해 처리한다 (직접 DB 접근 금지)
    bus.emit('recordCompleted', result)
    broadcast('event:libraryChanged', undefined)
    return result
  } finally {
    for (const file of [input, palettePath]) {
      try {
        rmSync(file, { force: true })
      } catch {
        // 임시 파일 정리 실패는 무시
      }
    }
    state = 'idle'
    currentOptions = null
    sendState('idle')
  }
}

// ─────────────── IPC 등록 ───────────────

export function registerRecorderIpc(): void {
  // 렌더러 getDisplayMedia → 저장된 RecordOptions 기준으로 화면 소스 매칭
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      void (async () => {
        try {
          const target = targetDisplay()
          const sources = await desktopCapturer.getSources({ types: ['screen'] })
          const source = sources.find((s) => s.display_id === String(target.id)) ?? sources[0]
          if (!source) {
            callback({})
            return
          }
          // Windows: 'loopback'으로 시스템 오디오 캡처 가능
          // TODO(platform-verify): macOS는 loopback 미지원 — 렌더러가 실패 시 audio 없이 재시도한다
          if (currentOptions?.systemAudio) {
            callback({ video: source, audio: 'loopback' })
          } else {
            callback({ video: source })
          }
        } catch {
          callback({})
        }
      })()
    },
    { useSystemPicker: false }
  )

  // recorder 창 생성 감지 → 카드 크기 확대 + 캡처 제외 설정
  app.on('browser-window-created', (_event, win) => {
    setImmediate(() => {
      if (!win.isDestroyed() && getWindow('recorder') === win) prepareRecorderWindow(win)
    })
  })

  handle('record:start', (options) => {
    // 영역 모드인데 region이 아직 없으면 "영역 선택 준비" 단계:
    // 창만 투명 풀스크린으로 확장하고, 렌더러가 드래그로 영역을 정한 뒤
    // region을 채워 record:start를 다시 호출한다.
    // TODO(contract): 전용 record:armRegionSelect 채널이 이상적 — 계약 확장은 Architect 승인 필요
    if (options.mode === 'region' && !options.region) {
      clearTimers()
      state = 'selecting'
      currentOptions = options
      const win = getWindow('recorder')
      if (win) toFullscreen(win, displayFor(options.displayId))
      return
    }
    beginCountdown(options)
  })

  handle('record:pause', () => {
    if (state !== 'recording') return
    accumulatedMs += Date.now() - resumedAt
    state = 'paused'
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
    sendState('paused', accumulatedMs)
  })

  handle('record:resume', () => {
    if (state !== 'paused') return
    state = 'recording'
    resumedAt = Date.now()
    sendState('recording', accumulatedMs)
    tickTimer = setInterval(() => sendState('recording', elapsedMs()), TICK_MS)
  })

  handle('record:stop', () => {
    const wasRecording = state === 'recording' || state === 'paused'
    const durationMs = wasRecording ? elapsedMs() : 0
    if (wasRecording) lastDurationMs = durationMs
    resetToIdle(true)
    sendState('idle')
    // 실제 미디어는 렌더러가 들고 있으므로 여기서는 잠정 결과만 돌려준다.
    // 최종 파일은 record:finalize에서 만들어진다.
    return { id: wasRecording ? randomUUID() : '', filePath: '', durationMs, format: 'webm' as const }
  })

  handle('record:finalize', (req) => finalizeRecording(req))
}
