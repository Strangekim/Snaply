/** 보관함 데이터 훅 — 목록/폴더/최근 항목 로딩과 이벤트 구독. 소유자: Library. */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryFolder, LibraryItem, LibraryQuery } from '@shared/ipc'

export type SidebarFilter =
  | { type: 'all' }
  | { type: 'favorite' }
  | { type: 'pinned' }
  | { type: 'folder'; folderId: string }

export interface LibraryData {
  items: LibraryItem[]
  recent: LibraryItem[]
  folders: LibraryFolder[]
  loading: boolean
  reload: () => void
}

function buildQuery(filter: SidebarFilter, text: string): LibraryQuery {
  const query: LibraryQuery = { limit: 500 }
  if (text.trim()) query.text = text.trim()
  if (filter.type === 'favorite') query.favoriteOnly = true
  if (filter.type === 'pinned') query.pinnedOnly = true
  if (filter.type === 'folder') query.folderId = filter.folderId
  return query
}

/** 최근 캡처 스트립용: 핀 고정 먼저, 이후 최신순으로 5개 */
function pickRecent(items: LibraryItem[]): LibraryItem[] {
  const sorted = [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.createdAt - a.createdAt
  })
  return sorted.slice(0, 5)
}

export function useLibrary(filter: SidebarFilter, searchText: string): LibraryData {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [recent, setRecent] = useState<LibraryItem[]>([])
  const [folders, setFolders] = useState<LibraryFolder[]>([])
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)

  const reload = useCallback(() => {
    const mySeq = ++seq.current
    setLoading(true)
    void Promise.all([
      window.snaply.invoke('library:list', buildQuery(filter, searchText)),
      window.snaply.invoke('library:list', { limit: 30 }),
      window.snaply.invoke('library:folders', undefined)
    ]).then(([list, recentList, folderList]) => {
      if (seq.current !== mySeq) return // 뒤늦게 도착한 응답은 무시
      setItems(list)
      setRecent(pickRecent(recentList))
      setFolders(folderList)
      setLoading(false)
    })
  }, [filter, searchText])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const offChanged = window.snaply.on('event:libraryChanged', () => reload())
    const offCaptured = window.snaply.on('event:captureCompleted', () => reload())
    return () => {
      offChanged()
      offCaptured()
    }
  }, [reload])

  return { items, recent, folders, loading, reload }
}

/** 300ms 디바운스 값 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
