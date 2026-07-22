/** 내보내기 엔진. 소유자: Architect.
 * PNG/JPG: nativeImage 인코딩, WebP/TIFF: ffmpeg-static 변환, PDF: 숨김 창 printToPDF.
 * PPTX: exportPptx.ts (Phase 4) */
import { app, BrowserWindow, dialog, nativeImage } from 'electron'
import { execFile } from 'child_process'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, dirname, extname, basename } from 'path'
import { promisify } from 'util'
import { handle } from './typedIpc'
import { getSettings } from './settings'
import type { ExportFormat } from '@shared/ipc'

const execFileAsync = promisify(execFile)

function ffmpegPath(): string {
  // dev: node_modules/ffmpeg-static/ffmpeg.exe, 패키징: asarUnpack됨
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require('ffmpeg-static') as string
  return p.replace('app.asar', 'app.asar.unpacked')
}

const FILTERS: Record<ExportFormat, Electron.FileFilter> = {
  png: { name: 'PNG 이미지', extensions: ['png'] },
  jpg: { name: 'JPG 이미지', extensions: ['jpg', 'jpeg'] },
  webp: { name: 'WebP 이미지', extensions: ['webp'] },
  pdf: { name: 'PDF 문서', extensions: ['pdf'] },
  tiff: { name: 'TIFF 이미지', extensions: ['tiff', 'tif'] },
  pptx: { name: 'PowerPoint 프레젠테이션', extensions: ['pptx'] }
}

async function askTargetPath(format: ExportFormat, suggestedName: string): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '내보내기',
    defaultPath: join(getSettings().savePath, suggestedName),
    filters: [FILTERS[format]]
  })
  return canceled || !filePath ? null : filePath
}

/** dataURL 또는 파일 경로에서 nativeImage 로드 */
function loadImage(source: { dataUrl?: string; filePath?: string }): Electron.NativeImage {
  const img = source.dataUrl
    ? nativeImage.createFromDataURL(source.dataUrl)
    : nativeImage.createFromPath(source.filePath!)
  if (img.isEmpty()) throw new Error('이미지를 불러오지 못했어요.')
  return img
}

async function convertWithFfmpeg(pngBuffer: Buffer, targetPath: string): Promise<void> {
  const tmp = join(app.getPath('temp'), `snaply-export-${Date.now()}.png`)
  writeFileSync(tmp, pngBuffer)
  try {
    await execFileAsync(ffmpegPath(), ['-y', '-i', tmp, targetPath])
  } finally {
    try {
      if (existsSync(tmp)) {
        const { unlinkSync } = await import('fs')
        unlinkSync(tmp)
      }
    } catch {
      // 임시 파일 정리 실패는 무시
    }
  }
}

async function exportPdf(img: Electron.NativeImage, targetPath: string): Promise<void> {
  const { width, height } = img.getSize()
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true }
  })
  try {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0}img{display:block;width:100%}
    </style></head><body><img src="${img.toDataURL()}"></body></html>`
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    // 이미지 크기에 맞춘 커스텀 페이지 (마이크론 단위)
    const pxToMicron = (px: number): number => Math.round((px / 96) * 25400)
    const pdf = await win.webContents.printToPDF({
      pageSize: { width: pxToMicron(width), height: pxToMicron(height) },
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    })
    writeFileSync(targetPath, pdf)
  } finally {
    win.destroy()
  }
}

export async function exportImage(
  source: { dataUrl?: string; filePath?: string },
  format: ExportFormat,
  targetPath?: string
): Promise<string> {
  const img = loadImage(source)
  if (format === 'pptx') {
    const { buildPptx } = await import('./exportPptx')
    const size = img.getSize()
    const suggested = source.filePath
      ? `${basename(source.filePath, extname(source.filePath))}.pptx`
      : `snaply-${Date.now()}.pptx`
    const pptxTarget = targetPath ?? (await askTargetPath('pptx', suggested))
    if (!pptxTarget) throw new Error('내보내기를 취소했어요.')
    mkdirSync(dirname(pptxTarget), { recursive: true })
    writeFileSync(pptxTarget, buildPptx([{ png: img.toPNG(), width: size.width, height: size.height }]))
    return pptxTarget
  }
  const baseName = source.filePath
    ? basename(source.filePath, extname(source.filePath))
    : `snaply-${Date.now()}`

  const target = targetPath ?? (await askTargetPath(format, `${baseName}.${format}`))
  if (!target) throw new Error('내보내기를 취소했어요.')
  mkdirSync(dirname(target), { recursive: true })

  switch (format) {
    case 'png':
      writeFileSync(target, img.toPNG())
      break
    case 'jpg':
      writeFileSync(target, img.toJPEG(92))
      break
    case 'webp':
    case 'tiff':
      await convertWithFfmpeg(img.toPNG(), target)
      break
    case 'pdf':
      await exportPdf(img, target)
      break
  }
  return target
}

export function registerExportIpc(): void {
  handle('export:run', async (req) => {
    const source = req.dataUrl
      ? { dataUrl: req.dataUrl }
      : req.itemId
        ? { filePath: await resolveItemPath(req.itemId) }
        : null
    if (!source) throw new Error('내보낼 대상이 없어요.')
    const filePath = await exportImage(source, req.format, req.targetPath)
    return { filePath }
  })
}

/** 라이브러리 항목 id → 파일 경로. 동적 import라 번들러가 청크로 분리해 준다
 * (require 리터럴은 번들 후 모듈 경로가 사라져 런타임 크래시 — QA P1) */
async function resolveItemPath(itemId: string): Promise<string> {
  const { getItem } = await import('./library/db')
  const item = getItem(itemId)
  if (!item) throw new Error('항목을 찾지 못했어요.')
  return item.filePath
}
