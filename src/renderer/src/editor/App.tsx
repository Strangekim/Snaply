/**
 * Snaply 에디터 창 — Konva 기반 객체 주석 에디터. 소유자: Editor.
 */
import { useCallback, useEffect, useState, type JSX } from 'react'
import { BottomSheet, Button, SheetItem, ToastProvider, useToast } from '@ds/index'
import type { ExportFormat } from '@shared/ipc'
import { useTheme } from '../common/useTheme'
import styles from './editor.module.css'
import { docSize, useEditorStore } from './store'
import { canRedo, canUndo } from './history'
import { flattenToDataUrl } from './stageRegistry'
import { flattenPadding } from './effects'
import { bboxToDocRect, findSensitiveWords } from './redaction'
import { createBlurArea, BLUR_INTENSITY } from './objects'
import { Toolbar } from './Toolbar'
import { PropertyPanel } from './PropertyPanel'
import { CanvasStage } from './CanvasStage'
import { StampPicker } from './StampPicker'
import { EffectsSheet } from './EffectsSheet'
import { TemplateSheet } from './TemplateSheet'
import { useEditorShortcuts } from './useEditorShortcuts'
import {
  IconCopy,
  IconRedo,
  IconSave,
  IconShield,
  IconSparkle,
  IconTemplate,
  IconUndo
} from './icons'
import type { BlurObj } from './types'

function EditorShell(): JSX.Element {
  const { toast } = useToast()
  const fileName = useEditorStore((s) => s.fileName)
  const imageUrl = useEditorStore((s) => s.imageUrl)
  const zoom = useEditorStore((s) => s.zoom)
  const history = useEditorStore((s) => s.history)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const openDocument = useEditorStore((s) => s.openDocument)
  const setSheet = useEditorStore((s) => s.setSheet)
  const [redacting, setRedacting] = useState(false)

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
    return flattenToDataUrl(width, height, flattenPadding(s.history.present.effects))
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

  /** 스마트 리댁션 — OCR로 민감정보를 찾아 모자이크 객체 자동 생성 */
  const handleRedact = useCallback((): void => {
    const s = useEditorStore.getState()
    if (!s.imageUrl || redacting) return
    setRedacting(true)
    void window.snaply
      .invoke('ocr:run', { source: s.imageUrl, languages: 'kor+eng' })
      .then((result) => {
        const state = useEditorStore.getState()
        const { width: docW, height: docH } = docSize(state)
        const crop = state.history.present.crop
        const matches = findSensitiveWords(result.words)
        const blurs: BlurObj[] = []
        for (const m of matches) {
          const rect = bboxToDocRect(m.bbox, crop, docW, docH)
          if (rect) blurs.push(createBlurArea(rect, 'mosaic', BLUR_INTENSITY.M))
        }
        if (blurs.length === 0) {
          toast('민감한 정보를 찾지 못했어요')
          return
        }
        state.addObjects(blurs)
        toast(`${blurs.length}건 가렸어요`)
      })
      .catch(() => toast('민감정보 인식에 실패했어요', { type: 'error' }))
      .finally(() => setRedacting(false))
  }, [redacting, toast])

  /** 현재 문서를 원하는 포맷으로 내보내기 (평탄화 dataURL 기반) */
  const [exportOpen, setExportOpen] = useState(false)
  const handleExport = useCallback(
    (format: ExportFormat): void => {
      setExportOpen(false)
      const dataUrl = flatten()
      if (!dataUrl) return
      void window.snaply
        .invoke('export:run', { dataUrl, format })
        .then(({ filePath }) => {
          toast('내보냈어요', { type: 'success' })
          void window.snaply.invoke('file:showInFolder', filePath)
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : ''
          if (!msg.includes('취소')) toast('내보내지 못했어요', { type: 'error' })
        })
    },
    [flatten, toast]
  )

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
          disabled={!imageUrl || redacting}
          onClick={handleRedact}
          title="OCR로 이메일·전화번호·카드번호·주민번호를 찾아 모자이크 처리해요"
        >
          <IconShield size={16} />
          &nbsp;{redacting ? '찾는 중...' : '민감정보 가리기'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!imageUrl}
          onClick={() => setSheet('effects')}
          title="테두리·그림자·라운드·찢어진 가장자리"
        >
          <IconSparkle size={16} />
          &nbsp;효과
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSheet('templates')}
          title="비교·튜토리얼·타임라인 템플릿으로 새 문서"
        >
          <IconTemplate size={16} />
          &nbsp;템플릿
        </Button>
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
          variant="secondary"
          size="sm"
          disabled={!imageUrl}
          onClick={() => setExportOpen(true)}
          title="PNG·JPG·WebP·PDF·TIFF·PPTX로 내보내요"
        >
          <IconSave size={16} />
          &nbsp;내보내기
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

      <StampPicker />
      <EffectsSheet />
      <TemplateSheet />

      {/* 내보내기 포맷 선택 시트 */}
      <BottomSheet open={exportOpen} onClose={() => setExportOpen(false)} title="어떤 형식으로 내보낼까요?">
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
            onClick={() => handleExport(format)}
          />
        ))}
      </BottomSheet>
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
