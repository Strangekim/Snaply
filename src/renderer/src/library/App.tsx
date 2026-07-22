/** Snaply 보관함 화면. 소유자: Library. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import { BottomSheet, Button, Input, Segmented, SheetItem, ToastProvider, useToast } from '@ds/index'
import type { ExportFormat, LibraryFolder, LibraryItem } from '@shared/ipc'
import { useTheme } from '../common/useTheme'
import { Onboarding } from '../onboarding/Onboarding'
import styles from './library.module.css'
import { useDebounced, useLibrary, type SidebarFilter } from './useLibrary'
import { Sidebar } from './Sidebar'
import { ItemCard, type ItemCardProps } from './ItemCard'
import { CameraIcon, FolderIcon, GridIcon, PinIcon, TimelineIcon } from './icons'
import { dayKey, dayLabel, fileName, relativeTime, toSnaplyFileUrl } from './format'

type ViewMode = 'grid' | 'timeline'
type BatchFormat = 'png' | 'jpg' | 'webp'

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
  cardProps,
  selectedIds
}: {
  items: LibraryItem[]
  cardProps: Omit<ItemCardProps, 'item' | 'selected'>
  selectedIds: ReadonlySet<string>
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
              <ItemCard key={item.id} item={item} selected={selectedIds.has(item.id)} {...cardProps} />
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

  // 텍스트 추출(Grab Text) 시트 상태
  const [ocrTarget, setOcrTarget] = useState<LibraryItem | null>(null)
  const [ocrText, setOcrText] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)

  // 다중 선택 + 배치 내보내기 상태
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const lastSelectedIndexRef = useRef<number | null>(null)
  const [batchSheetOpen, setBatchSheetOpen] = useState(false)
  const [batchWidth, setBatchWidth] = useState('')
  const [batchFormat, setBatchFormat] = useState<BatchFormat>('png')
  const [batchWatermark, setBatchWatermark] = useState('')
  const [batchRunning, setBatchRunning] = useState(false)

  // 단건 내보내기 / 공유 시트
  const [exportTarget, setExportTarget] = useState<LibraryItem | null>(null)
  const [shareTarget, setShareTarget] = useState<LibraryItem | null>(null)
  const [shareTargets, setShareTargets] = useState<
    Array<{ id: string; label: string; available: boolean; comingSoon?: boolean }>
  >([])

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

  // ── 텍스트 추출 (Grab Text) ──
  const recognizeText = useCallback((item: LibraryItem, force: boolean) => {
    if (!force && item.ocrText) {
      // 이미 인식된 텍스트가 있으면 즉시 표시
      setOcrText(item.ocrText)
      setOcrLoading(false)
      setOcrError(null)
      return
    }
    setOcrText(null)
    setOcrError(null)
    setOcrLoading(true)
    void window.snaply
      .invoke('ocr:run', { source: item.filePath, languages: 'kor+eng' })
      .then((result) => {
        setOcrText(result.text)
        setOcrLoading(false)
        // 인식 결과를 항목에 저장 → FTS 검색에도 반영
        void window.snaply.invoke('library:update', { id: item.id, patch: { ocrText: result.text } })
      })
      .catch(() => {
        setOcrLoading(false)
        setOcrError('텍스트를 추출하지 못했어요. 잠시 후 다시 시도해 주세요.')
      })
  }, [])

  const openGrabText = useCallback(
    (item: LibraryItem) => {
      setOcrTarget(item)
      recognizeText(item, false)
    },
    [recognizeText]
  )

  const copyOcrText = useCallback(() => {
    if (!ocrText) return
    void window.snaply
      .invoke('clipboard:writeText', ocrText)
      .then(() => toast('텍스트를 복사했어요'))
      .catch(() => toast('복사하지 못했어요', { type: 'error' }))
  }, [ocrText, toast])

  // ── 다중 선택 / 배치 내보내기 ──
  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
    lastSelectedIndexRef.current = null
  }, [])

  const toggleSelect = useCallback(
    (item: LibraryItem, shiftKey: boolean) => {
      const index = items.findIndex((i) => i.id === item.id)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        const anchor = lastSelectedIndexRef.current
        if (shiftKey && anchor !== null && index >= 0) {
          // Shift 클릭: 마지막 클릭 지점부터 범위 선택
          const [from, to] = anchor < index ? [anchor, index] : [index, anchor]
          for (let i = from; i <= to; i++) next.add(items[i].id)
        } else if (next.has(item.id)) {
          next.delete(item.id)
        } else {
          next.add(item.id)
        }
        return next
      })
      lastSelectedIndexRef.current = index
    },
    [items]
  )

  const runBatchExport = useCallback(() => {
    const width = Number.parseInt(batchWidth, 10)
    setBatchRunning(true)
    void window.snaply
      .invoke('export:batch', {
        itemIds: [...selectedIds],
        resize: Number.isFinite(width) && width > 0 ? { width } : undefined,
        watermarkText: batchWatermark.trim() || undefined,
        format: batchFormat
      })
      .then(({ outputDir, count }) => {
        toast(`${count}개를 내보냈어요`, { type: 'success' })
        void window.snaply.invoke('file:showInFolder', outputDir)
        setBatchSheetOpen(false)
        exitSelectMode()
      })
      .catch(() => toast('내보내지 못했어요', { type: 'error' }))
      .finally(() => setBatchRunning(false))
  }, [batchWidth, batchWatermark, batchFormat, selectedIds, toast, exitSelectMode])

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

  // ── 단건 내보내기 / 공유 ──
  const runExport = useCallback(
    (item: LibraryItem, format: ExportFormat) => {
      setExportTarget(null)
      void window.snaply
        .invoke('export:run', { itemId: item.id, format })
        .then(({ filePath }) => {
          toast('내보냈어요', { type: 'success' })
          void window.snaply.invoke('file:showInFolder', filePath)
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : ''
          if (!msg.includes('취소')) toast('내보내지 못했어요', { type: 'error' })
        })
    },
    [toast]
  )

  const runShare = useCallback(
    (item: LibraryItem, targetId: string) => {
      setShareTarget(null)
      void window.snaply
        .invoke('share:run', { targetId, itemId: item.id })
        .then(({ ok, message }) => {
          if (message) toast(message, { type: ok ? 'success' : 'error' })
        })
        .catch(() => toast('공유하지 못했어요', { type: 'error' }))
    },
    [toast]
  )

  const cardProps: Omit<ItemCardProps, 'item' | 'selected'> = {
    onTogglePin: togglePin,
    onToggleFavorite: toggleFavorite,
    onEdit: openInEditor,
    onCopy: copyToClipboard,
    onMove: setMoveTarget,
    onShowInFolder: showInFolder,
    onDelete: setDeleteTarget,
    onGrabText: openGrabText,
    onExport: setExportTarget,
    onShare: (item) => {
      setShareTarget(item)
      void window.snaply.invoke('share:targets', undefined).then(setShareTargets)
    },
    selectMode,
    onSelectToggle: toggleSelect
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
            <Button
              variant={selectMode ? 'primary' : 'secondary'}
              size="md"
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            >
              {selectMode ? '선택 끝내기' : '선택'}
            </Button>
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
                  <ItemCard key={item.id} item={item} selected={selectedIds.has(item.id)} {...cardProps} />
                ))}
              </div>
            </>
          ) : (
            <TimelineView items={items} cardProps={cardProps} selectedIds={selectedIds} />
          )}
        </div>

        {/* 다중 선택 하단 액션바 */}
        {selectMode && (
          <div className={styles.selectBar}>
            <span className={styles.selectCount}>{selectedIds.size}개 선택됨</span>
            <Button variant="secondary" size="md" onClick={exitSelectMode}>
              취소해요
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={selectedIds.size === 0}
              onClick={() => setBatchSheetOpen(true)}
            >
              일괄 내보내기
            </Button>
          </div>
        )}
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

      {/* 텍스트 추출(Grab Text) 시트 */}
      <BottomSheet open={ocrTarget !== null} onClose={() => setOcrTarget(null)} title="추출한 텍스트">
        {ocrLoading ? (
          <div className={styles.ocrLoading}>
            <span className={styles.spinner} aria-hidden="true" />
            <span>텍스트를 인식하고 있어요…</span>
          </div>
        ) : ocrError ? (
          <p className={styles.ocrErrorText}>{ocrError}</p>
        ) : ocrText !== null && ocrText.trim().length === 0 ? (
          <p className={styles.ocrErrorText}>인식된 텍스트가 없어요.</p>
        ) : (
          <pre className={styles.ocrBox}>{ocrText ?? ''}</pre>
        )}
        <div className={styles.sheetActions}>
          <Button
            variant="secondary"
            fullWidth
            disabled={ocrLoading}
            onClick={() => ocrTarget && recognizeText(ocrTarget, true)}
          >
            다시 인식해요
          </Button>
          <Button variant="primary" fullWidth disabled={ocrLoading || !ocrText?.trim()} onClick={copyOcrText}>
            전체 복사해요
          </Button>
        </div>
      </BottomSheet>

      {/* 단건 내보내기 시트 */}
      <BottomSheet open={exportTarget !== null} onClose={() => setExportTarget(null)} title="어떤 형식으로 내보낼까요?">
        {(['png', 'jpg', 'webp', 'pdf', 'tiff', 'pptx'] as ExportFormat[]).map((format) => (
          <SheetItem
            key={format}
            title={format.toUpperCase()}
            description={
              format === 'pdf'
                ? '문서로 보관하기 좋아요'
                : format === 'pptx'
                  ? '슬라이드로 바로 편집할 수 있어요'
                  : format === 'webp'
                    ? '용량이 작아요'
                    : undefined
            }
            onClick={() => exportTarget && runExport(exportTarget, format)}
          />
        ))}
      </BottomSheet>

      {/* 공유 시트 */}
      <BottomSheet open={shareTarget !== null} onClose={() => setShareTarget(null)} title="어디로 공유할까요?">
        {shareTargets.map((target) => (
          <SheetItem
            key={target.id}
            title={target.label}
            description={target.comingSoon ? '준비 중이에요' : undefined}
            disabled={!target.available}
            onClick={() => {
              if (target.available && shareTarget) runShare(shareTarget, target.id)
            }}
          />
        ))}
        {shareTargets.length === 0 && (
          <div style={{ color: 'var(--text-sub)', padding: 'var(--space-3)' }}>공유 대상을 불러오고 있어요...</div>
        )}
      </BottomSheet>

      {/* 일괄 내보내기 시트 */}
      <BottomSheet
        open={batchSheetOpen}
        onClose={() => {
          if (!batchRunning) setBatchSheetOpen(false)
        }}
        title={`${selectedIds.size}개를 일괄 내보내요`}
      >
        <div className={styles.batchForm}>
          <Input
            label="리사이즈 폭 (px)"
            type="number"
            placeholder="비워 두면 원본 크기 그대로예요"
            value={batchWidth}
            onChange={(event) => setBatchWidth(event.target.value)}
            min={1}
          />
          <div>
            <div className={styles.batchLabel}>포맷</div>
            <Segmented<BatchFormat>
              aria-label="내보내기 포맷"
              fullWidth
              value={batchFormat}
              onChange={setBatchFormat}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpg', label: 'JPG' },
                { value: 'webp', label: 'WebP' }
              ]}
            />
          </div>
          <Input
            label="워터마크 텍스트"
            placeholder="비워 두면 워터마크 없이 내보내요"
            value={batchWatermark}
            onChange={(event) => setBatchWatermark(event.target.value)}
          />
          <Button variant="primary" fullWidth loading={batchRunning} onClick={runBatchExport}>
            내보내요
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}

export function App(): JSX.Element {
  useTheme()
  // 첫 실행이면 온보딩을 먼저 보여준다
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)
  useEffect(() => {
    void window.snaply.invoke('settings:get', undefined).then((s) => setShowOnboarding(!s.onboardingDone))
  }, [])

  return (
    <ToastProvider>
      <LibraryScreen />
      {showOnboarding && (
        <Onboarding
          onDone={() => {
            setShowOnboarding(false)
            void window.snaply.invoke('settings:set', { onboardingDone: true })
          }}
        />
      )}
    </ToastProvider>
  )
}
