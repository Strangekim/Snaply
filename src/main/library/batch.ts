/**
 * 배치 프로세싱(export:batch) — 리사이즈/워터마크/포맷 변환 일괄 내보내기. 소유자: Library.
 *
 * - 리사이즈: nativeImage.resize (한 축만 주면 비율 유지)
 * - 워터마크/WebP: 메인 프로세스엔 캔버스가 없으므로 숨김 BrowserWindow의
 *   <canvas>에서 합성·인코딩한다 (배치당 창 1개를 재사용하고 끝나면 파괴).
 *   Chromium 캔버스는 image/webp 인코딩을 지원한다. 미지원 환경이면 toDataURL이
 *   PNG로 폴백하므로 결과 mime을 확인해 확장자를 .png로 바꾼다. (TODO: ffmpeg 폴백)
 * - 출력: savePath/batch-{timestamp}/ 폴더에 원본 파일명 기반으로 저장.
 */
import { BrowserWindow, nativeImage } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import { handle } from '../typedIpc'
import { getSettings } from '../settings'
import { getItem } from './db'

type BatchFormat = 'png' | 'jpg' | 'webp'

interface BatchRequest {
  itemIds: string[]
  resize?: { width?: number; height?: number }
  watermarkText?: string
  format?: BatchFormat
}

const JPEG_QUALITY = 92

function timestampSlug(now = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
}

/** 같은 이름이 이미 있으면 -2, -3… 을 붙여 겹치지 않는 경로를 만든다 */
function uniquePath(dir: string, base: string, ext: string): string {
  let candidate = join(dir, `${base}.${ext}`)
  for (let n = 2; existsSync(candidate); n++) {
    candidate = join(dir, `${base}-${n}.${ext}`)
  }
  return candidate
}

/** 숨김 창의 캔버스에서 워터마크 합성 + 목표 포맷 인코딩 → dataURL 반환 */
async function renderOnCanvas(
  win: BrowserWindow,
  sourceDataUrl: string,
  watermarkText: string | undefined,
  mime: string
): Promise<string> {
  const script = `(async () => {
    const img = new Image()
    img.src = ${JSON.stringify(sourceDataUrl)}
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const text = ${JSON.stringify(watermarkText ?? '')}
    if (text) {
      // 우하단 반투명 워터마크 — 그림자(어두운 사본)로 밝은 배경에서도 보이게
      const fontSize = Math.max(14, Math.round(canvas.width / 40))
      const pad = Math.round(fontSize * 0.8)
      ctx.font = '600 ' + fontSize + 'px "Pretendard", "Malgun Gothic", sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.fillText(text, canvas.width - pad + 1, canvas.height - pad + 1)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
      ctx.fillText(text, canvas.width - pad, canvas.height - pad)
    }
    return canvas.toDataURL(${JSON.stringify(mime)}, ${JPEG_QUALITY / 100})
  })()`
  return (await win.webContents.executeJavaScript(script)) as string
}

async function createCanvasWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await win.loadURL('about:blank')
  return win
}

const MIME_BY_FORMAT: Record<BatchFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp'
}

export async function runBatchExport(req: BatchRequest): Promise<{ outputDir: string; count: number }> {
  const format: BatchFormat = req.format ?? 'png'
  const watermark = req.watermarkText?.trim() || undefined
  const outputDir = join(getSettings().savePath, `batch-${timestampSlug()}`)
  mkdirSync(outputDir, { recursive: true })

  // 워터마크 또는 webp 인코딩이 필요할 때만 캔버스 창을 만든다
  const needsCanvas = watermark !== undefined || format === 'webp'
  let canvasWin: BrowserWindow | null = null
  let count = 0

  try {
    for (const itemId of req.itemIds) {
      const item = getItem(itemId)
      // 이미지 항목만 처리 (video/gif는 nativeImage로 다룰 수 없어 건너뜀)
      if (!item || item.kind !== 'image') continue

      try {
        let img = nativeImage.createFromPath(item.filePath)
        if (img.isEmpty()) continue

        if (req.resize && (req.resize.width || req.resize.height)) {
          const opts: { width?: number; height?: number } = {}
          if (req.resize.width && req.resize.width > 0) opts.width = Math.round(req.resize.width)
          if (req.resize.height && req.resize.height > 0) opts.height = Math.round(req.resize.height)
          // nativeImage.resize는 한 축만 지정하면 비율을 유지한다
          img = img.resize({ ...opts, quality: 'best' })
        }

        const base = basename(item.filePath, extname(item.filePath))
        let ext: string = format
        let buffer: Buffer

        if (needsCanvas) {
          canvasWin ??= await createCanvasWindow()
          const outUrl = await renderOnCanvas(canvasWin, img.toDataURL(), watermark, MIME_BY_FORMAT[format])
          // webp 미지원 환경이면 canvas가 PNG로 폴백 — 확장자를 실제 mime에 맞춘다
          if (format === 'webp' && !outUrl.startsWith('data:image/webp')) ext = 'png'
          buffer = dataUrlToBuffer(outUrl)
        } else {
          buffer = format === 'jpg' ? img.toJPEG(JPEG_QUALITY) : img.toPNG()
        }

        writeFileSync(uniquePath(outputDir, base, ext), buffer)
        count++
      } catch (err) {
        // 한 항목 실패는 배치 전체를 멈추지 않는다
        console.warn('[library] 배치 내보내기 항목 실패(건너뜀):', itemId, err)
      }
    }
  } finally {
    canvasWin?.destroy()
  }

  return { outputDir, count }
}

/** dataURL의 base64 페이로드를 Buffer로 (인코딩 결과를 그대로 저장할 때 사용) */
function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(',')
  return Buffer.from(dataUrl.slice(comma + 1), 'base64')
}

export function registerBatchExportIpc(): void {
  handle('export:batch', (req) => runBatchExport(req))
}
