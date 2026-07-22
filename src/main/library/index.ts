/**
 * Snaply 보관함 메인 모듈. 소유자: Library.
 * 역할: 캡처 자동 저장(bus 'captureCompleted' 구독), 자동 태깅, 썸네일 생성,
 * library:* IPC 핸들러 등록.
 */
import { app, nativeImage } from 'electron'
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { randomUUID } from 'crypto'
import { handle } from '../typedIpc'
import { bus } from '../bus'
import { broadcast } from '../windows'
import { getSettings } from '../settings'
import {
  deleteFolder,
  deleteItem,
  getItem,
  insertFolder,
  insertItem,
  listFolders,
  listItems,
  updateItem
} from './db'
import { registerOcrIpc, runOcr } from './ocr'
import { registerBatchExportIpc } from './batch'
import type { CaptureMode, CaptureResult, LibraryItem, RecordResult } from '@shared/ipc'

// ───────────────────────── 자동 태깅 ─────────────────────────

const MODE_TAGS: Record<CaptureMode, string> = {
  region: '영역',
  window: '창',
  fullscreen: '전체 화면',
  scrolling: '스크롤',
  'all-in-one': '영역'
}

/** 날짜 태그: '2026-07' 형태 */
function dateTag(createdAt: number): string {
  const d = new Date(createdAt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function autoTags(result: CaptureResult): string[] {
  const tags = [dateTag(result.createdAt), MODE_TAGS[result.mode]]
  if (result.sourceApp) tags.push(result.sourceApp)
  return [...new Set(tags)]
}

// ───────────────────────── 썸네일 ─────────────────────────

const THUMB_WIDTH = 320

function thumbsDir(): string {
  const dir = join(app.getPath('userData'), 'thumbs')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 320px 폭 PNG 썸네일 생성. 실패 시 undefined(카드에서 원본으로 대체) */
function createThumbnail(id: string, filePath: string): string | undefined {
  try {
    const img = nativeImage.createFromPath(filePath)
    if (img.isEmpty()) return undefined
    const size = img.getSize()
    const resized = size.width > THUMB_WIDTH ? img.resize({ width: THUMB_WIDTH }) : img
    const thumbPath = join(thumbsDir(), `${id}.png`)
    writeFileSync(thumbPath, resized.toPNG())
    return thumbPath
  } catch {
    return undefined
  }
}

function safeFileSize(filePath: string): number {
  try {
    return statSync(filePath).size
  } catch {
    return 0
  }
}

function safeUnlink(filePath: string | undefined): void {
  if (!filePath) return
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch {
    // 파일 삭제 실패는 무시 (사용 중이거나 이미 없음)
  }
}

// ───────────────────────── 캡처 자동 저장 ─────────────────────────

function saveCaptureToLibrary(result: CaptureResult): void {
  const item: LibraryItem = {
    id: result.id,
    filePath: result.filePath,
    thumbPath: createThumbnail(result.id, result.filePath),
    kind: 'image',
    mode: result.mode,
    width: result.width,
    height: result.height,
    createdAt: result.createdAt,
    sourceApp: result.sourceApp,
    sourceTitle: result.sourceTitle,
    tags: autoTags(result),
    pinned: false,
    favorite: false,
    fileSize: safeFileSize(result.filePath)
  }
  insertItem(item)
  broadcast('event:libraryChanged', undefined)
}

// ───────────────────────── 캡처 자동 OCR 인덱싱 ─────────────────────────
// 캡처 저장 직후 2초 디바운스 큐에 모았다가 백그라운드로 OCR을 돌려 ocr_text를 채운다.
// (updateItem이 FTS를 재동기화하므로 검색에 바로 반영된다. 실패는 조용히 무시.)
// TODO(Phase 4): 설정에서 자동 OCR 끄는 옵션 추가

const OCR_DEBOUNCE_MS = 2000
const ocrPending: string[] = []
let ocrTimer: NodeJS.Timeout | null = null
let ocrDraining = false

function scheduleOcrIndexing(itemId: string): void {
  if (!ocrPending.includes(itemId)) ocrPending.push(itemId)
  if (ocrTimer) clearTimeout(ocrTimer)
  ocrTimer = setTimeout(() => {
    ocrTimer = null
    void drainOcrQueue()
  }, OCR_DEBOUNCE_MS)
}

async function drainOcrQueue(): Promise<void> {
  if (ocrDraining) return
  ocrDraining = true
  try {
    while (ocrPending.length > 0) {
      const id = ocrPending.shift()
      if (!id) continue
      const item = getItem(id)
      // 이미 인식했거나 이미지가 아니면 건너뜀
      if (!item || item.kind !== 'image' || item.ocrText) continue
      try {
        const result = await runOcr({ source: item.filePath })
        if (result.text) {
          updateItem(id, { ocrText: result.text })
          broadcast('event:libraryChanged', undefined)
        }
      } catch (err) {
        console.warn('[library] 자동 OCR 실패(무시):', err)
      }
    }
  } finally {
    ocrDraining = false
  }
}

// ───────────────────────── 녹화 결과 등록 ─────────────────────────

function saveRecordingToLibrary(result: RecordResult): void {
  const kind = result.format === 'gif' ? 'gif' : 'video'
  const createdAt = Date.now()
  const item: LibraryItem = {
    id: result.id,
    filePath: result.filePath,
    // gif는 nativeImage가 첫 프레임을 읽을 수 있어 썸네일 시도, 실패하면 카드에서 원본 표시.
    // TODO(Phase 4): video(mp4/webm) 썸네일 — ffmpeg로 첫 프레임 추출
    thumbPath: kind === 'gif' ? createThumbnail(result.id, result.filePath) : undefined,
    kind,
    // 녹화 해상도는 ffprobe 없이 알 수 없어 0으로 저장 (계약상 허용)
    width: 0,
    height: 0,
    createdAt,
    tags: [dateTag(createdAt), '녹화'],
    pinned: false,
    favorite: false,
    fileSize: safeFileSize(result.filePath)
  }
  insertItem(item)
  broadcast('event:libraryChanged', undefined)
}

// ───────────────────────── 편집 결과 저장 ─────────────────────────

/** `{원본이름}-edited-N.png` 형태로 겹치지 않는 새 경로를 찾는다 */
function nextEditedPath(originalPath: string): string {
  const dir = dirname(originalPath)
  const base = basename(originalPath, extname(originalPath))
  for (let n = 1; n < 1000; n++) {
    const candidate = join(dir, `${base}-edited-${n}.png`)
    if (!existsSync(candidate)) return candidate
  }
  return join(dir, `${base}-edited-${Date.now()}.png`)
}

function saveEdited(req: { itemId?: string; dataUrl: string; overwrite: boolean }): LibraryItem {
  const img = nativeImage.createFromDataURL(req.dataUrl)
  if (img.isEmpty()) throw new Error('이미지를 저장하지 못했어요. 다시 시도해 주세요.')
  const png = img.toPNG()
  const size = img.getSize()
  const original = req.itemId ? getItem(req.itemId) : null

  if (req.overwrite && original) {
    // 원본 파일 교체 + 썸네일 재생성
    writeFileSync(original.filePath, png)
    const updated = updateItem(original.id, {
      width: size.width,
      height: size.height,
      fileSize: png.length,
      thumbPath: createThumbnail(original.id, original.filePath)
    })
    broadcast('event:libraryChanged', undefined)
    return updated ?? original
  }

  // 새 파일 + 새 항목
  const filePath = original
    ? nextEditedPath(original.filePath)
    : join(getSettings().savePath, `snaply-edited-${Date.now()}.png`)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, png)

  const id = randomUUID()
  const createdAt = Date.now()
  const item: LibraryItem = {
    id,
    filePath,
    thumbPath: createThumbnail(id, filePath),
    kind: 'image',
    mode: original?.mode,
    width: size.width,
    height: size.height,
    createdAt,
    sourceApp: original?.sourceApp,
    sourceTitle: original?.sourceTitle,
    tags: [...new Set([dateTag(createdAt), '편집', ...(original?.sourceApp ? [original.sourceApp] : [])])],
    pinned: false,
    favorite: false,
    folderId: original?.folderId,
    fileSize: png.length
  }
  insertItem(item)
  broadcast('event:libraryChanged', undefined)
  return item
}

// ───────────────────────── IPC 등록 ─────────────────────────

export function registerLibraryIpc(): void {
  bus.on('captureCompleted', (result) => {
    try {
      saveCaptureToLibrary(result)
      scheduleOcrIndexing(result.id)
    } catch (err) {
      console.error('[library] 캡처 자동 저장 실패:', err)
    }
  })

  bus.on('recordCompleted', (result) => {
    try {
      saveRecordingToLibrary(result)
    } catch (err) {
      console.error('[library] 녹화 결과 등록 실패:', err)
    }
  })

  handle('library:list', (query) => listItems(query ?? {}))

  handle('library:get', (id) => getItem(id))

  handle('library:update', ({ id, patch }) => {
    updateItem(id, patch)
    broadcast('event:libraryChanged', undefined)
  })

  handle('library:delete', (id) => {
    const item = getItem(id)
    if (item) {
      safeUnlink(item.filePath)
      safeUnlink(item.thumbPath)
    }
    deleteItem(id)
    broadcast('event:libraryChanged', undefined)
  })

  handle('library:folders', () => listFolders())

  handle('library:createFolder', (name) => {
    const folder = { id: randomUUID(), name: name.trim() || '새 폴더', createdAt: Date.now() }
    insertFolder(folder)
    broadcast('event:libraryChanged', undefined)
    return folder
  })

  handle('library:deleteFolder', (id) => {
    deleteFolder(id)
    broadcast('event:libraryChanged', undefined)
  })

  handle('library:saveEdited', (req) => saveEdited(req))

  registerOcrIpc()
  registerBatchExportIpc()
}
