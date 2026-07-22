/**
 * Snaply 보관함 DB — node:sqlite(DatabaseSync) 기반. 소유자: Library.
 * userData/library.db 에 items/folders + FTS5(items_fts)를 관리한다.
 */
import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'fs'
import { basename, join } from 'path'
import type { ItemKind, CaptureMode, LibraryFolder, LibraryItem, LibraryQuery } from '@shared/ipc'

let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (db) return db
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  db = new DatabaseSync(join(dir, 'library.db'))
  db.exec('PRAGMA journal_mode = WAL')
  migrate(db)
  return db
}

/** 테스트/종료 시 정리용 */
export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ───────────────────────── 마이그레이션 (PRAGMA user_version) ─────────────────────────

function migrate(d: DatabaseSync): void {
  const row = d.prepare('PRAGMA user_version').get() as { user_version: number } | undefined
  const version = row?.user_version ?? 0

  if (version < 1) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        thumb_path TEXT,
        kind TEXT NOT NULL DEFAULT 'image',
        mode TEXT,
        width INTEGER NOT NULL DEFAULT 0,
        height INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        source_app TEXT,
        source_title TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        pinned INTEGER NOT NULL DEFAULT 0,
        favorite INTEGER NOT NULL DEFAULT 0,
        folder_id TEXT,
        ocr_text TEXT,
        file_size INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_items_folder ON items(folder_id);

      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        item_id UNINDEXED,
        file_name,
        tags,
        ocr_text,
        source
      );

      PRAGMA user_version = 1;
    `)
  }
}

// ───────────────────────── row ↔ LibraryItem 매핑 ─────────────────────────

interface ItemRow {
  id: string
  file_path: string
  thumb_path: string | null
  kind: string
  mode: string | null
  width: number
  height: number
  created_at: number
  source_app: string | null
  source_title: string | null
  tags: string
  pinned: number
  favorite: number
  folder_id: string | null
  ocr_text: string | null
  file_size: number
}

function rowToItem(row: ItemRow): LibraryItem {
  let tags: string[] = []
  try {
    const parsed = JSON.parse(row.tags)
    if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string')
  } catch {
    // 손상된 tags는 빈 배열로
  }
  return {
    id: row.id,
    filePath: row.file_path,
    thumbPath: row.thumb_path ?? undefined,
    kind: row.kind as ItemKind,
    mode: (row.mode as CaptureMode | null) ?? undefined,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    sourceApp: row.source_app ?? undefined,
    sourceTitle: row.source_title ?? undefined,
    tags,
    pinned: row.pinned === 1,
    favorite: row.favorite === 1,
    folderId: row.folder_id ?? undefined,
    ocrText: row.ocr_text ?? undefined,
    fileSize: row.file_size
  }
}

// ───────────────────────── FTS 동기화 ─────────────────────────

function ftsSourceText(item: LibraryItem): string {
  return [item.sourceApp, item.sourceTitle].filter(Boolean).join(' ')
}

function upsertFts(item: LibraryItem): void {
  const d = getDb()
  d.prepare('DELETE FROM items_fts WHERE item_id = ?').run(item.id)
  d.prepare('INSERT INTO items_fts (item_id, file_name, tags, ocr_text, source) VALUES (?, ?, ?, ?, ?)').run(
    item.id,
    basename(item.filePath),
    item.tags.join(' '),
    item.ocrText ?? '',
    ftsSourceText(item)
  )
}

/** 사용자 입력을 안전한 FTS5 프리픽스 질의로 변환. 예: 'foo b' → '"foo"* "b"*' */
function buildFtsMatch(text: string): string | null {
  const terms = text
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
  if (terms.length === 0) return null
  return terms.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' ')
}

// ───────────────────────── items CRUD ─────────────────────────

export function insertItem(item: LibraryItem): void {
  getDb()
    .prepare(
      `INSERT INTO items
        (id, file_path, thumb_path, kind, mode, width, height, created_at,
         source_app, source_title, tags, pinned, favorite, folder_id, ocr_text, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      item.id,
      item.filePath,
      item.thumbPath ?? null,
      item.kind,
      item.mode ?? null,
      item.width,
      item.height,
      item.createdAt,
      item.sourceApp ?? null,
      item.sourceTitle ?? null,
      JSON.stringify(item.tags),
      item.pinned ? 1 : 0,
      item.favorite ? 1 : 0,
      item.folderId ?? null,
      item.ocrText ?? null,
      item.fileSize
    )
  upsertFts(item)
}

export function getItem(id: string): LibraryItem | null {
  const row = getDb().prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined
  return row ? rowToItem(row) : null
}

/**
 * 항목 부분 수정. folderId에 빈 문자열('')을 주면 폴더에서 제거(NULL)로 처리한다
 * (IPC의 JSON 직렬화에서 undefined가 탈락하기 때문).
 */
export function updateItem(id: string, patch: Partial<LibraryItem>): LibraryItem | null {
  const current = getItem(id)
  if (!current) return null

  const next: LibraryItem = {
    ...current,
    ...(patch.filePath !== undefined ? { filePath: patch.filePath } : {}),
    ...(patch.thumbPath !== undefined ? { thumbPath: patch.thumbPath } : {}),
    ...(patch.width !== undefined ? { width: patch.width } : {}),
    ...(patch.height !== undefined ? { height: patch.height } : {}),
    ...(patch.fileSize !== undefined ? { fileSize: patch.fileSize } : {}),
    ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
    ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
    ...(patch.favorite !== undefined ? { favorite: patch.favorite } : {}),
    ...(patch.ocrText !== undefined ? { ocrText: patch.ocrText } : {}),
    ...(patch.folderId !== undefined ? { folderId: patch.folderId === '' ? undefined : patch.folderId } : {})
  }

  getDb()
    .prepare(
      `UPDATE items SET
        file_path = ?, thumb_path = ?, width = ?, height = ?, file_size = ?,
        tags = ?, pinned = ?, favorite = ?, ocr_text = ?, folder_id = ?
       WHERE id = ?`
    )
    .run(
      next.filePath,
      next.thumbPath ?? null,
      next.width,
      next.height,
      next.fileSize,
      JSON.stringify(next.tags),
      next.pinned ? 1 : 0,
      next.favorite ? 1 : 0,
      next.ocrText ?? null,
      next.folderId ?? null,
      id
    )
  upsertFts(next)
  return next
}

export function deleteItem(id: string): void {
  const d = getDb()
  d.prepare('DELETE FROM items WHERE id = ?').run(id)
  d.prepare('DELETE FROM items_fts WHERE item_id = ?').run(id)
}

// ───────────────────────── 목록 조회 ─────────────────────────

const DEFAULT_LIMIT = 200

export function listItems(query: LibraryQuery): LibraryItem[] {
  const where: string[] = []
  const params: Array<string | number> = []

  const text = query.text?.trim()
  if (text) {
    const match = buildFtsMatch(text)
    if (match) {
      // FTS 매치 + 파일명 LIKE 병행 (부분 문자열 검색 보완)
      const escaped = text.replace(/([%_\\])/g, '\\$1')
      where.push('(id IN (SELECT item_id FROM items_fts WHERE items_fts MATCH ?) OR file_path LIKE ? ESCAPE ?)')
      params.push(match, `%${escaped}%`, '\\')
    }
  }
  if (query.kind) {
    where.push('kind = ?')
    params.push(query.kind)
  }
  if (query.folderId) {
    where.push('folder_id = ?')
    params.push(query.folderId)
  }
  if (query.favoriteOnly) where.push('favorite = 1')
  if (query.pinnedOnly) where.push('pinned = 1')
  if (query.from !== undefined) {
    where.push('created_at >= ?')
    params.push(query.from)
  }
  if (query.to !== undefined) {
    where.push('created_at <= ?')
    params.push(query.to)
  }
  for (const tag of query.tags ?? []) {
    where.push("tags LIKE ? ESCAPE '\\'")
    params.push(`%"${tag.replace(/([%_\\])/g, '\\$1')}"%`)
  }

  const sql = `SELECT * FROM items
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?`
  params.push(query.limit ?? DEFAULT_LIMIT, query.offset ?? 0)

  const rows = getDb().prepare(sql).all(...params) as unknown as ItemRow[]
  return rows.map(rowToItem)
}

// ───────────────────────── folders ─────────────────────────

interface FolderRow {
  id: string
  name: string
  created_at: number
}

export function listFolders(): LibraryFolder[] {
  const rows = getDb().prepare('SELECT * FROM folders ORDER BY created_at ASC').all() as unknown as FolderRow[]
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }))
}

export function insertFolder(folder: LibraryFolder): void {
  getDb().prepare('INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)').run(
    folder.id,
    folder.name,
    folder.createdAt
  )
}

/** 폴더 삭제 — 소속 항목은 folder_id를 NULL로 되돌린다 */
export function deleteFolder(id: string): void {
  const d = getDb()
  d.prepare('UPDATE items SET folder_id = NULL WHERE folder_id = ?').run(id)
  d.prepare('DELETE FROM folders WHERE id = ?').run(id)
}
