/** Snaply 보관함 화면. 소유자: Library. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { BottomSheet, Button, Input, Segmented, SheetItem, ToastProvider, useToast } from '@ds/index'
import type { LibraryFolder, LibraryItem } from '@shared/ipc'
import { useTheme } from '../common/useTheme'
import styles from './library.module.css'
import { useDebounced, useLibrary, type SidebarFilter } from './useLibrary'
import { Sidebar } from './Sidebar'
import { ItemCard, type ItemCardProps } from './ItemCard'
import { CameraIcon, FolderIcon, GridIcon, PinIcon, TimelineIcon } from './icons'
import { dayKey, dayLabel, fileName, relativeTime, toSnaplyFileUrl } from './format'

type ViewMode = 'grid' | 'timeline'

// ───────────────────────── 빈 상태 ─────────────────────────

function EmptyState({ searching }: { searching: boolean }): JSX.Element {
  return (
    <div className={styles.empty}>
      <svg width="140" height="110" viewBox="0 0 140 110" fill="none" aria-hidden="true">
        <rect x="18" y="26" width="104" height="68" rx="12" fill="var(--bg-input)" />
        <rect x="30" y="38" width="80" height="44" rx="8" fill="var(--bg-card)" stroke="var(--border-divider)" />
        <circle cx="70" cy="60" r="13" stroke="var(--primary)" strokeWidth="3" fill="none" />
        <circle cx="70" cy="60" r="5" fill="var(--primary)" />
        <rect x="58" y="16" width="24" height="12" rx="4" fill="var(--bg-input)" />
        <circle cx="106" cy="44" r="3" fill="var(--yellow-500)" />
      </svg>
      <div>
        <div className={styles.emptyTitle}>{searching ? '검색 결과가 없어요' : '아직 캡처가 없어요'}</div>
        <div className={styles.emptyDesc}>
          {searching ? '다른 검색어로 다시 찾아보세요.' : '캡처하기 버튼이나 단축키로 첫 캡처를 시작해 보세요.'}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── 최근 캡처 스트립 ─────────────────────────

function RecentStrip({ items, onOpen }: { items: LibraryItem[]; onOpen: (item: LibraryItem) => void }): JSX.Element | null {
  if (items.length === 0) return null
  return (
    <>
      <h2 className={styles.contentTitle}>최근 캡처</h2>
      <div className={styles.strip}>
        {items.map((item) => (
          <button key={item.id} type="button" className={styles.stripCard} onClick={() => onOpen(item)} title="편집해요">
            <img
              className={styles.stripThumb}
              src={toSnaplyFileUrl(item.thumbPath ?? item.filePath)}
              alt={fileName(item.filePath)}
              loading="lazy"
            />
            {item.pinned && (
              <span className={styles.stripPin}>
                <PinIcon size={12} filled />
              </span>
            )}
            <div className={styles.stripMeta}>{relativeTime(item.createdAt)}</div>
          </button>
        ))}
      </div>
    </>
  )
}

// ───────────────────────── 타임라인 뷰 ─────────────────────────

function TimelineView({
  items,
  cardProps
}: {
  items: LibraryItem[]
  cardProps: Omit<ItemCardProps, 'item'>
}): JSX.Element {
  const groups = useMemo(() => {
    const map = new Map<string, LibraryItem[]>()
    for (const item of items) {
      const key = dayKey(item.createdAt)
      const list = map.get(key)
      if (list) list.push(item)
      else map.set(key, [item])
    }
    return [...map.values()]
  }, [items])

  return (
    <div>
      {groups.map((group) => (
        <section key={dayKey(group[0].createdAt)} className={styles.timelineSection}>
          <div className={styles.timelineHeader}>{dayLabel(group[0].createdAt)}</div>
          <div className={styles.grid}>
            {group.map((item) => (
              <ItemCard key={item.id} item={item} {...cardProps} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ───────────────────────── 메인 화면 ─────────────────────────

function LibraryScreen(): JSX.Element {
  const { toast } = useToast()
  const [filter, setFilter] = useState<SidebarFilter>({ type: 'all' })
  const [view, setView] = useState<ViewMode>('grid')
  const [searchInput, setSearchInput] = useState('')
  const searchText = useDebounced(searchInput, 300)
  const { items, recent, folders } = useLibrary(filter, searchText)

  // 시트 상태
  const [moveTarget, setMoveTarget] = useState<LibraryItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LibraryItem | null>(null)
  const [folderSheetOpen, setFolderSheetOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<LibraryFolder | null>(null)

  // 캡처 완료 토스트
  useEffect(() => {
    return window.snaply.on('event:captureCompleted', () => {
      toast('캡처했어요', { type: 'success' })
    })
  }, [toast])

  // ── 항목 액션 ──
  const togglePin = useCallback((item: LibraryItem) => {
    void window.snaply.invoke('library:update', { id: item.id, patch: { pinned: !item.pinned } })
  }, [])

  const toggleFavorite = useCallback((item: LibraryItem) => {
    void window.snaply.invoke('library:update', { id: item.id, patch: { favorite: !item.favorite } })
  }, [])

  const openInEditor = useCallback((item: LibraryItem) => {
    void window.snaply.invoke('window:open', {
      window: 'editor',
      payload: { itemId: item.id, filePath: item.filePath }
    })
  }, [])

  const copyToClipboard = useCallback(
    (item: LibraryItem) => {
      void window.snaply
        .invoke('clipboard:writeImage', { filePath: item.filePath })
        .then(() => toast('클립보드에 복사했어요'))
        .catch(() => toast('복사하지 못했어요', { type: 'error' }))
    },
    [toast]
  )

  const showInFolder = useCallback((item: LibraryItem) => {
    void window.snaply.invoke('file:showInFolder', item.filePath)
  }, [])

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return
    void window.snaply
      .invoke('library:delete', deleteTarget.id)
      .then(() => toast('삭제했어요'))
      .catch(() => toast('삭제하지 못했어요', { type: 'error' }))
    setDeleteTarget(null)
  }, [deleteTarget, toast])

  const moveToFolder = useCallback(
    (folderId: string) => {
      if (!moveTarget) return
      void window.snaply
        .invoke('library:update', { id: moveTarget.id, patch: { folderId } })
        .then(() => toast(folderId === '' ? '폴더에서 꺼냈어요' : '폴더로 옮겼어요'))
      setMoveTarget(null)
    },
    [moveTarget, toast]
  )

  // ── 폴더 액션 ──
  const createFolder = useCallback(() => {
    const name = newFolderName.trim()
    if (!name) {
      toast('폴더 이름을 입력해 주세요', { type: 'error' })
      return
    }
    void window.snaply
      .invoke('library:createFolder', name)
      .then(() => toast('폴더를 만들었어요'))
      .catch(() => toast('폴더를 만들지 못했어요', { type: 'error' }))
    setNewFolderName('')
    setFolderSheetOpen(false)
  }, [newFolderName, toast])

  const confirmDeleteFolder = useCallback(() => {
    if (!folderDeleteTarget) return
    const target = folderDeleteTarget
    void window.snaply
      .invoke('library:deleteFolder', target.id)
      .then(() => toast('폴더를 삭제했어요'))
    setFolderDeleteTarget(null)
    setFilter((prev) => (prev.type === 'folder' && prev.folderId === target.id ? { type: 'all' } : prev))
  }, [folderDeleteTarget, toast])

  const cardProps: Omit<ItemCardProps, 'item'> = {
    onTogglePin: togglePin,
    onToggleFavorite: toggleFavorite,
    onEdit: openInEditor,
    onCopy: copyToClipboard,
    onMove: setMoveTarget,
    onShowInFolder: showInFolder,
    onDelete: setDeleteTarget
  }

  const searching = searchText.trim().length > 0
  const showStrip = filter.type === 'all' && !searching

  return (
    <div className={styles.root}>
      <Sidebar
        filter={filter}
        folders={folders}
        onSelect={setFilter}
        onAddFolder={() => setFolderSheetOpen(true)}
        onDeleteFolder={setFolderDeleteTarget}
      />

      <div className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.searchWrap}>
            <Input
              type="search"
              placeholder="파일명, 태그, 추출한 텍스트로 검색해요"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="보관함 검색"
            />
          </div>
          <div className={styles.topbarRight}>
            <Segmented<ViewMode>
              aria-label="보기 방식"
              size="md"
              value={view}
              onChange={setView}
              options={[
                { value: 'grid', label: '그리드', icon: <GridIcon size={14} /> },
                { value: 'timeline', label: '타임라인', icon: <TimelineIcon size={14} /> }
              ]}
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => void window.snaply.invoke('capture:start', { mode: 'all-in-one' })}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <CameraIcon size={16} />
                캡처하기
              </span>
            </Button>
          </div>
        </div>

        <div className={styles.content}>
          {showStrip && <RecentStrip items={recent} onOpen={openInEditor} />}

          {items.length === 0 ? (
            <EmptyState searching={searching} />
          ) : view === 'grid' ? (
            <>
              {showStrip && <h2 className={styles.contentTitle}>모든 캡처</h2>}
              <div className={styles.grid}>
                {items.map((item) => (
                  <ItemCard key={item.id} item={item} {...cardProps} />
                ))}
              </div>
            </>
          ) : (
            <TimelineView items={items} cardProps={cardProps} />
          )}
        </div>
      </div>

      {/* 폴더 이동 시트 */}
      <BottomSheet open={moveTarget !== null} onClose={() => setMoveTarget(null)} title="폴더로 이동해요">
        <SheetItem
          icon={<FolderIcon size={16} />}
          title="폴더 없음"
          description="폴더에서 꺼내요"
          selected={moveTarget?.folderId === undefined}
          onClick={() => moveToFolder('')}
        />
        {folders.map((folder) => (
          <SheetItem
            key={folder.id}
            icon={<FolderIcon size={16} />}
            title={folder.name}
            selected={moveTarget?.folderId === folder.id}
            onClick={() => moveToFolder(folder.id)}
          />
        ))}
        {folders.length === 0 && (
          <div style={{ color: 'var(--text-sub)', padding: 'var(--space-3)' }}>
            아직 폴더가 없어요. 사이드바에서 폴더를 먼저 만들어 주세요.
          </div>
        )}
      </BottomSheet>

      {/* 항목 삭제 확인 시트 */}
      <BottomSheet open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="캡처를 삭제할까요?">
        <p className={styles.deleteDesc}>
          {deleteTarget ? `'${fileName(deleteTarget.filePath)}' 파일도 함께 삭제돼요. 되돌릴 수 없어요.` : ''}
        </p>
        <div className={styles.sheetActions}>
          <Button variant="secondary" fullWidth onClick={() => setDeleteTarget(null)}>
            취소해요
          </Button>
          <Button variant="danger" fullWidth onClick={confirmDelete}>
            삭제해요
          </Button>
        </div>
      </BottomSheet>

      {/* 폴더 추가 시트 */}
      <BottomSheet
        open={folderSheetOpen}
        onClose={() => {
          setFolderSheetOpen(false)
          setNewFolderName('')
        }}
        title="새 폴더를 만들어요"
      >
        <div className={styles.folderForm}>
          <Input
            label="폴더 이름"
            placeholder="예: 업무 스크린샷"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') createFolder()
            }}
            autoFocus
          />
          <Button variant="primary" fullWidth onClick={createFolder}>
            만들어요
          </Button>
        </div>
      </BottomSheet>

      {/* 폴더 삭제 확인 시트 */}
      <BottomSheet
        open={folderDeleteTarget !== null}
        onClose={() => setFolderDeleteTarget(null)}
        title="폴더를 삭제할까요?"
      >
        <p className={styles.deleteDesc}>
          {folderDeleteTarget ? `'${folderDeleteTarget.name}' 폴더만 삭제되고, 안의 캡처는 전체 목록에 남아요.` : ''}
        </p>
        <div className={styles.sheetActions}>
          <Button variant="secondary" fullWidth onClick={() => setFolderDeleteTarget(null)}>
            취소해요
          </Button>
          <Button variant="danger" fullWidth onClick={confirmDeleteFolder}>
            삭제해요
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}

export function App(): JSX.Element {
  useTheme()
  return (
    <ToastProvider>
      <LibraryScreen />
    </ToastProvider>
  )
}
