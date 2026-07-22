/**
 * 스크롤(파노라마) 캡처 엔진 — 메인 프로세스.
 * 흐름: 대상 영역 프레임 캡처 → OS 레벨 휠 스크롤 주입 → 렌더 안정화 대기 → 재캡처 →
 *       이전 프레임과 실질적 동일(하단 도달)이면 종료 → stitch.ts로 세로 스티칭.
 *
 * 플랫폼:
 * - Windows: PowerShell Add-Type으로 user32 SendInput(MOUSEEVENTF_WHEEL) 호출.
 *   주입 전 SetCursorPos로 커서를 대상 영역 중앙으로 이동(휠 이벤트는 커서 아래 창으로 전달됨).
 * - macOS: TODO(platform-verify) — 아래 injectScrollDarwin 참고 (osascript 스텁).
 */
import { app, desktopCapturer, nativeImage, screen } from 'electron'
import { execFile } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import type { RegionRect } from '@shared/ipc'
import { framesAlmostIdentical, stitchFrames, type StitchFrame } from './stitch'

const execFileAsync = promisify(execFile)

/** 안전 장치: 최대 스크롤 스텝 수 */
const MAX_STEPS = 30
/** 스크롤 주입 후 렌더 안정화 대기 (ms) */
const SETTLE_MS = 400
/** 스텝당 휠 노치 수. 1노치 ≈ 3줄(브라우저 약 100px).
 * TODO: 앱별 스크롤 배율이 달라 겹침이 부족하면(오프셋 미탐지) 값을 줄여야 할 수 있다 */
const WHEEL_NOTCHES = 3

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// ─────────────── 대상 영역 프레임 획득 ───────────────

function getDisplay(displayId: number): Electron.Display {
  return screen.getAllDisplays().find((d) => d.id === displayId) ?? screen.getPrimaryDisplay()
}

const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max)

/** 대상 디스플레이를 캡처해 rect(DIP, 디스플레이 로컬 좌표)를 물리 픽셀로 크롭한 비트맵 반환 */
async function grabRegionBitmap(rect: RegionRect): Promise<StitchFrame> {
  const display = getDisplay(rect.displayId)
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.bounds.width * display.scaleFactor),
      height: Math.round(display.bounds.height * display.scaleFactor)
    }
  })
  const source = sources.find((s) => String(display.id) === s.display_id) ?? sources[0]
  if (!source) throw new Error('화면 소스를 찾지 못했어요.')
  const image = source.thumbnail
  const frameSize = image.getSize()
  // DPI 대응: 실제 프레임 크기 / 디스플레이 DIP 크기 비율로 축별 스케일 계산 (capture/index.ts cropFrame과 동일한 방식)
  const scaleX = frameSize.width / display.bounds.width
  const scaleY = frameSize.height / display.bounds.height
  const x = clamp(Math.round(rect.x * scaleX), 0, frameSize.width - 1)
  const y = clamp(Math.round(rect.y * scaleY), 0, frameSize.height - 1)
  const width = Math.max(1, Math.min(Math.round(rect.width * scaleX), frameSize.width - x))
  const height = Math.max(1, Math.min(Math.round(rect.height * scaleY), frameSize.height - y))
  const cropped = image.crop({ x, y, width, height })
  const size = cropped.getSize()
  // toBitmap: 플랫폼 의존 채널 순서(Windows는 BGRA). 최종 합성도 같은 포맷으로 createFromBitmap 하므로 일관됨
  return { data: new Uint8Array(cropped.toBitmap()), width: size.width, height: size.height }
}

// ─────────────── 스크롤 주입 ───────────────

/** Windows 휠 스크롤 주입 스크립트 (SetCursorPos + SendInput/MOUSEEVENTF_WHEEL).
 * Delta가 0이면 커서 이동만 수행한다 (캡처 종료 후 커서 복원용). */
const SCROLL_PS1 = `param([int]$X, [int]$Y, [int]$Delta)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SnaplyScroll {
  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT { public uint type; public MOUSEINPUT mi; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll", SetLastError = true)] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  public static void Run(int x, int y, int delta) {
    SetProcessDPIAware();
    SetCursorPos(x, y);
    if (delta == 0) return;
    INPUT[] inputs = new INPUT[1];
    inputs[0].type = 0; // INPUT_MOUSE
    inputs[0].mi.dwFlags = 0x0800; // MOUSEEVENTF_WHEEL
    inputs[0].mi.mouseData = unchecked((uint)delta);
    SendInput(1u, inputs, Marshal.SizeOf(typeof(INPUT)));
  }
}
'@
[SnaplyScroll]::Run($X, $Y, $Delta)
`

let scriptPath: string | null = null

function ensureScrollScript(): string {
  if (!scriptPath) {
    scriptPath = join(app.getPath('temp'), 'snaply-scroll.ps1')
    writeFileSync(scriptPath, SCROLL_PS1, 'utf-8')
  }
  return scriptPath
}

/** DIP 좌표 → 물리 화면 좌표 (SetCursorPos는 물리 픽셀 기준. dipToScreenPoint는 Windows 전용) */
function toPhysicalPoint(dipX: number, dipY: number): { x: number; y: number } {
  const point = { x: Math.round(dipX), y: Math.round(dipY) }
  if (process.platform === 'win32' && typeof screen.dipToScreenPoint === 'function') {
    return screen.dipToScreenPoint(point)
  }
  return point
}

/** 커서를 (dipX, dipY)로 옮기고 휠 notches만큼 아래로 스크롤. notches 0이면 커서 이동만 */
async function injectScroll(dipX: number, dipY: number, notches: number): Promise<void> {
  if (process.platform === 'win32') {
    const p = toPhysicalPoint(dipX, dipY)
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        ensureScrollScript(),
        '-X',
        String(p.x),
        '-Y',
        String(p.y),
        '-Delta',
        String(-120 * notches)
      ],
      { timeout: 10_000, windowsHide: true }
    )
    return
  }
  if (process.platform === 'darwin') {
    // TODO(platform-verify): macOS는 SendInput 대응이 없어 CGEventCreateScrollWheelEvent 기반
    // 네이티브 헬퍼가 필요하다. 아래 osascript(key code 121 = Page Down)는 포커스된 앱에만
    // 전달되는 임시 스텁 — 커서 위치 기반 휠 주입/스크롤량 제어가 보장되지 않는다.
    if (notches > 0) {
      await execFileAsync('osascript', ['-e', 'tell application "System Events" to key code 121'], { timeout: 10_000 })
    }
    return
  }
  throw new Error('이 플랫폼에서는 스크롤 캡처를 지원하지 않아요.')
}

// ─────────────── 캡처 루프 + 스티칭 ───────────────

export interface ScrollingCaptureOutput {
  /** 최종 PNG 버퍼 */
  buffer: Buffer
  width: number
  height: number
}

/**
 * rect(DIP, 디스플레이 로컬 좌표) 영역을 자동 스크롤하며 연속 캡처 후 스티칭한 PNG를 반환한다.
 * 호출 전에 오버레이가 화면에서 사라진 상태여야 한다.
 */
export async function captureScrollingRegion(
  rect: RegionRect,
  onProgress?: (progress: number) => void
): Promise<ScrollingCaptureOutput> {
  const display = getDisplay(rect.displayId)
  // 휠 이벤트가 대상 창으로 가도록 커서를 영역 중앙으로 (절대 DIP 좌표)
  const centerX = display.bounds.x + rect.x + rect.width / 2
  const centerY = display.bounds.y + rect.y + rect.height / 2
  const originalCursor = screen.getCursorScreenPoint()

  const frames: StitchFrame[] = []
  let prev = await grabRegionBitmap(rect)
  frames.push(prev)
  onProgress?.(1 / (MAX_STEPS + 1))

  try {
    for (let step = 1; step <= MAX_STEPS; step++) {
      await injectScroll(centerX, centerY, WHEEL_NOTCHES)
      await sleep(SETTLE_MS)
      const next = await grabRegionBitmap(rect)
      if (next.width !== prev.width || next.height !== prev.height) {
        // 캡처 도중 디스플레이 구성이 바뀐 경우 — 지금까지 모은 프레임으로 마무리
        break
      }
      if (framesAlmostIdentical(prev, next)) break // 더 이상 스크롤되지 않음 = 하단 도달
      frames.push(next)
      prev = next
      onProgress?.(Math.min(0.95, (step + 1) / (MAX_STEPS + 1)))
    }
  } finally {
    // 커서 원위치 (실패해도 캡처 결과에는 영향 없음)
    void injectScroll(originalCursor.x, originalCursor.y, 0).catch(() => {})
  }

  const stitched = stitchFrames(frames)
  onProgress?.(1)

  const image = nativeImage.createFromBitmap(
    Buffer.from(stitched.data.buffer, stitched.data.byteOffset, stitched.data.byteLength),
    { width: stitched.width, height: stitched.height }
  )
  return { buffer: image.toPNG(), width: stitched.width, height: stitched.height }
}
