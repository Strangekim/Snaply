/**
 * Snaply 에디터 창 — Konva 기반 객체 주석 에디터. 소유자: Editor.
 */
import { useCallback, useEffect, type JSX } from 'react'
import { Button, ToastProvider, useToast } from '@ds/index'
import { useTheme } from '../common/useTheme'
import styles from './editor.module.css'
import { docSize, useEditorStore } from './store'
import { canRedo, canUndo } from './history'
import { flattenToDataUrl } from './stageRegistry'
import { Toolbar } from './Toolbar'
import { PropertyPanel } from './PropertyPanel'
import { CanvasStage } from './CanvasStage'
import { useEditorShortcuts } from './useEditorShortcuts'
import { IconCopy, IconRedo, IconSave, IconUndo } from './icons'

function EditorShell(): JSX.Element {
  const { toast } = useToast()
  const fileName = useEditorStore((s) => s.fileName)
  const imageUrl = useEditorStore((s) => s.imageUrl)
  const zoom = useEditorStore((s) => s.zoom)
  const history = useEditorStore((s) => s.history)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const openDocument = useEditorStore((s) => s.openDocument)

  // 캡처 → 에디터로 열기
  useEffect(() => {
    return window.snaply.on('event:openInEditor', ({ itemId, filePath }) => {
      void window.snaply
        .invoke('file:readDataUrl', filePath)
        .then(
          (dataUrl) =>
            new Promise<void>((resolve, reject) => {
              const img = new window.Image()
              img.onload = () => {
                openDocument({
                  itemId,
                  filePath,
                  imageUrl: dataUrl,
                  width: img.naturalWidth,
                  height: img.naturalHeight
                })
                resolve()
              }
              img.onerror = () => reject(new Error('image decode failed'))
              img.src = dataUrl
            })
        )
        .catch(() => toast('이미지를 불러오지 못했어요', { type: 'error' }))
    })
  }, [openDocument, toast])

  /** 현재 문서를 PNG로 평탄화 (선택 해제 + UI 레이어 숨김 상태로) */
  const flatten = useCallback((): string | null => {
    const s = useEditorStore.getState()
    if (!s.imageUrl) return null
    s.setEditingText(null)
    s.clearSelection()
    const { width, height } = docSize(s)
    return flattenToDataUrl(width, height)
  }, [])

  const handleSave = useCallback((): void => {
    const s = useEditorStore.getState()
    const dataUrl = flatten()
    if (!dataUrl) return
    void window.snaply
      .invoke('library:saveEdited', {
        itemId: s.itemId ?? undefined,
        dataUrl,
        overwrite: false
      })
      .then(() => toast('저장했어요'))
      .catch(() => toast('저장에 실패했어요', { type: 'error' }))
  }, [flatten, toast])

  const handleCopyImage = useCallback((): void => {
    const dataUrl = flatten()
    if (!dataUrl) return
    void window.snaply
      .invoke('clipboard:writeImage', { dataUrl })
      .then(() => toast('복사했어요'))
      .catch(() => toast('복사에 실패했어요', { type: 'error' }))
  }, [flatten, toast])

  useEditorShortcuts({ onSave: handleSave, onCopyImage: handleCopyImage })

  return (
    <div className={styles.root}>
      <div className={styles.appBar}>
        <span className={styles.fileName}>{fileName || '캡처 대기 중'}</span>
        <div className={styles.spacer} />
        <button
          type="button"
          className={styles.iconButton}
          title="실행 취소 (Ctrl+Z)"
          aria-label="실행 취소"
          disabled={!canUndo(history)}
          onClick={undo}
        >
          <IconUndo />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          title="다시 실행 (Ctrl+Shift+Z)"
          aria-label="다시 실행"
          disabled={!canRedo(history)}
          onClick={redo}
        >
          <IconRedo />
        </button>
        <span className={styles.zoomBadge}>{Math.round(zoom * 100)}%</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={!imageUrl}
          onClick={handleCopyImage}
          title="클립보드로 복사 (Ctrl+Shift+C)"
        >
          <IconCopy size={16} />
          &nbsp;복사
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!imageUrl}
          onClick={handleSave}
          title="저장 (Ctrl+S)"
        >
          <IconSave size={16} />
          &nbsp;저장
        </Button>
      </div>

      <PropertyPanel />

      <div className={styles.body}>
        <Toolbar />
        {imageUrl ? (
          <CanvasStage />
        ) : (
          <div className={styles.canvasWrap}>
            <div className={styles.emptyState}>캡처하면 여기서 편집할 수 있어요</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function App(): JSX.Element {
  useTheme()
  return (
    <ToastProvider>
      <EditorShell />
    </ToastProvider>
  )
}
