/**
 * 중앙 캔버스 — Konva Stage + 도구 인터랙션. 소유자: Editor.
 * 문서 좌표계 = 원본 이미지 픽셀 좌표계. 줌/팬은 Stage scale/position로만 처리한다.
 */
import { useEffect, useRef, useState, type JSX } from 'react'
import { Image as KImage, Layer, Rect, Stage, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Button } from '@ds/index'
import styles from './editor.module.css'
import { useEditorStore } from './store'
import { stageRegistry } from './stageRegistry'
import { AnnotationNode } from './AnnotationNode'
import { TextEditOverlay } from './TextEditOverlay'
import {
  clampRectToBounds,
  fitToViewport,
  normalizeRect,
  stageToDoc,
  zoomAtPoint
} from './geometry'
import { resolveCssVar } from './palette'
import {
  appendDraftPoint,
  createArrow,
  createCallout,
  createEllipse,
  createHighlight,
  createLine,
  createPen,
  createRect,
  createText,
  isDraftMeaningful,
  resizeDraft,
  withDefaultTail
} from './objects'
import type { AnnoObject, Point, RectArea } from './types'

/** dataURL → HTMLImageElement */
function useHtmlImage(src: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!src) {
      setImg(null)
      return
    }
    const el = new window.Image()
    el.onload = () => setImg(el)
    el.src = src
    return () => {
      el.onload = null
    }
  }, [src])
  return img
}

interface Draft {
  start: Point
  obj: AnnoObject
}

interface CropDraft {
  start: Point
  rect: RectArea
  dragging: boolean
}

export function CanvasStage(): JSX.Element {
  const imageUrl = useEditorStore((s) => s.imageUrl)
  const activeTool = useEditorStore((s) => s.activeTool)
  const zoom = useEditorStore((s) => s.zoom)
  const pan = useEditorStore((s) => s.pan)
  const style = useEditorStore((s) => s.style)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const objects = useEditorStore((s) => s.history.present.objects)
  const crop = useEditorStore((s) => s.history.present.crop)
  const editingTextId = useEditorStore((s) => s.editingTextId)
  const itemId = useEditorStore((s) => s.itemId)
  const imageWidth = useEditorStore((s) => s.imageWidth)
  const imageHeight = useEditorStore((s) => s.imageHeight)
  const docW = crop ? crop.width : imageWidth
  const docH = crop ? crop.height : imageHeight

  const setZoomPan = useEditorStore((s) => s.setZoomPan)
  const setPan = useEditorStore((s) => s.setPan)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const addObject = useEditorStore((s) => s.addObject)
  const addStep = useEditorStore((s) => s.addStep)
  const setEditingText = useEditorStore((s) => s.setEditingText)
  const applyCrop = useEditorStore((s) => s.applyCrop)

  const wrapRef = useRef<HTMLDivElement>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const [wrapSize, setWrapSize] = useState({ width: 0, height: 0 })
  const [space, setSpace] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null)

  const interactive = activeTool === 'select' && !space

  // 컨테이너 크기 추적
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setWrapSize({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)
    setWrapSize({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // 새 문서/크롭 변경 시 화면에 맞춤
  const fitKeyRef = useRef('')
  useEffect(() => {
    if (!imageUrl || docW <= 0 || wrapSize.width <= 0) return
    const key = `${itemId ?? ''}|${docW}x${docH}`
    if (fitKeyRef.current === key) return
    fitKeyRef.current = key
    const fit = fitToViewport(docW, docH, wrapSize.width, wrapSize.height)
    setZoomPan(fit.zoom, fit.pan)
  }, [imageUrl, itemId, docW, docH, wrapSize, setZoomPan])

  // 스페이스 팬 모드
  useEffect(() => {
    const isTyping = (e: KeyboardEvent): boolean => {
      const t = e.target as HTMLElement | null
      return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)
    }
    const down = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && !isTyping(e)) {
        e.preventDefault()
        setSpace(true)
      }
      if (e.key === 'Escape') {
        setDraft(null)
        setCropDraft(null)
      }
    }
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'Space') setSpace(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // 도구 변경 시 진행 중 draft 정리
  useEffect(() => {
    setDraft(null)
    if (activeTool !== 'crop') setCropDraft(null)
  }, [activeTool])

  // Transformer ↔ 선택 노드 연결
  useEffect(() => {
    const tr = trRef.current
    const stage = stageRegistry.stage
    if (!tr || !stage) return
    if (!interactive || selectedIds.length === 0) {
      tr.nodes([])
    } else {
      const nodes = selectedIds
        .map((id) => stage.findOne(`#${id}`))
        .filter((n): n is Konva.Node => !!n)
      tr.nodes(nodes)
    }
    tr.getLayer()?.batchDraw()
  }, [selectedIds, objects, interactive, editingTextId])

  const pointerDocPos = (stage: Konva.Stage): Point | null => {
    const pos = stage.getPointerPosition()
    if (!pos) return null
    return stageToDoc(pos, zoom, pan)
  }

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>): void => {
    if (space || e.evt.button !== 0) return
    const stage = e.target.getStage()
    if (!stage) return
    const p = pointerDocPos(stage)
    if (!p) return

    switch (activeTool) {
      case 'select':
        if (e.target === stage) clearSelection()
        break
      case 'text': {
        const obj = createText(p, style)
        addObject(obj)
        setEditingText(obj.id)
        break
      }
      case 'step':
        addStep(p)
        break
      case 'arrow':
        setDraft({ start: p, obj: createArrow(p, style) })
        break
      case 'line':
        setDraft({ start: p, obj: createLine(p, style) })
        break
      case 'rect':
        setDraft({ start: p, obj: createRect(p, style) })
        break
      case 'ellipse':
        setDraft({ start: p, obj: createEllipse(p, style) })
        break
      case 'callout':
        setDraft({ start: p, obj: createCallout(p, style) })
        break
      case 'highlighter':
        setDraft({ start: p, obj: createHighlight(p, style) })
        break
      case 'pen':
        setDraft({ start: p, obj: createPen(p, style) })
        break
      case 'crop':
        setCropDraft({ start: p, rect: { x: p.x, y: p.y, width: 0, height: 0 }, dragging: true })
        break
    }
  }

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>): void => {
    const stage = e.target.getStage()
    if (!stage) return
    const p = pointerDocPos(stage)
    if (!p) return

    if (draft) {
      setDraft((d) => {
        if (!d) return d
        if (d.obj.type === 'pen' || d.obj.type === 'highlight') {
          return { ...d, obj: appendDraftPoint(d.obj, d.start, p) }
        }
        return { ...d, obj: resizeDraft(d.obj, d.start, p) }
      })
    } else if (cropDraft?.dragging) {
      setCropDraft((c) =>
        c ? { ...c, rect: clampRectToBounds(normalizeRect(c.start, p), docW, docH) } : c
      )
    }
  }

  const handleMouseUp = (): void => {
    if (draft) {
      let obj = draft.obj
      if (obj.type === 'callout') {
        if (!isDraftMeaningful(obj)) {
          obj = { ...obj, width: 180, height: 80 }
        }
        obj = withDefaultTail(obj)
        addObject(obj)
        setEditingText(obj.id)
      } else if (isDraftMeaningful(obj)) {
        addObject(obj)
      }
      setDraft(null)
    }
    if (cropDraft?.dragging) {
      setCropDraft((c) => {
        if (!c) return null
        if (c.rect.width < 8 || c.rect.height < 8) return null
        return { ...c, dragging: false }
      })
    }
  }

  const handleWheel = (e: KonvaEventObject<WheelEvent>): void => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const factor = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1
      const next = zoomAtPoint(zoom, pan, pointer, zoom * factor)
      setZoomPan(next.zoom, next.pan)
    } else {
      const dx = e.evt.shiftKey ? e.evt.deltaY : e.evt.deltaX
      const dy = e.evt.shiftKey ? 0 : e.evt.deltaY
      setPan({ x: pan.x - dx, y: pan.y - dy })
    }
  }

  const handleStageDragEnd = (e: KonvaEventObject<DragEvent>): void => {
    const stage = e.target.getStage()
    if (stage && e.target === stage) {
      setPan({ x: stage.x(), y: stage.y() })
    }
  }

  const image = useHtmlImage(imageUrl)

  const cursor = space
    ? 'grab'
    : activeTool === 'select'
      ? 'default'
      : 'crosshair'

  const dimColor = resolveCssVar('--overlay-dim')
  const cropStroke = resolveCssVar('--blue-500')

  return (
    <div ref={wrapRef} className={styles.canvasWrap} style={{ cursor }}>
      {imageUrl && wrapSize.width > 0 && (
        <Stage
          ref={(node) => {
            stageRegistry.stage = node
          }}
          width={wrapSize.width}
          height={wrapSize.height}
          scaleX={zoom}
          scaleY={zoom}
          x={pan.x}
          y={pan.y}
          draggable={space}
          onDragEnd={handleStageDragEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* 배경 이미지 */}
          <Layer listening={false}>
            {image && (
              <KImage
                image={image}
                x={0}
                y={0}
                width={docW}
                height={docH}
                crop={crop ?? undefined}
              />
            )}
          </Layer>

          {/* 주석 객체 */}
          <Layer listening={interactive}>
            {objects.map((o) => (
              <AnnotationNode key={o.id} obj={o} interactive={interactive} />
            ))}
            {draft && <AnnotationNode obj={draft.obj} interactive={false} />}
          </Layer>

          {/* UI 레이어 (내보내기 제외) */}
          <Layer
            ref={(node) => {
              stageRegistry.uiLayer = node
            }}
          >
            <Transformer
              ref={trRef}
              rotateEnabled
              flipEnabled={false}
              ignoreStroke
              boundBoxFunc={(oldBox, newBox) =>
                Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8 ? oldBox : newBox
              }
            />
            {cropDraft && cropDraft.rect.width > 0 && (
              <>
                {/* 크롭 밖 딤 처리 (상/하/좌/우) */}
                <Rect x={0} y={0} width={docW} height={cropDraft.rect.y} fill={dimColor} listening={false} />
                <Rect
                  x={0}
                  y={cropDraft.rect.y + cropDraft.rect.height}
                  width={docW}
                  height={Math.max(0, docH - cropDraft.rect.y - cropDraft.rect.height)}
                  fill={dimColor}
                  listening={false}
                />
                <Rect
                  x={0}
                  y={cropDraft.rect.y}
                  width={cropDraft.rect.x}
                  height={cropDraft.rect.height}
                  fill={dimColor}
                  listening={false}
                />
                <Rect
                  x={cropDraft.rect.x + cropDraft.rect.width}
                  y={cropDraft.rect.y}
                  width={Math.max(0, docW - cropDraft.rect.x - cropDraft.rect.width)}
                  height={cropDraft.rect.height}
                  fill={dimColor}
                  listening={false}
                />
                <Rect
                  x={cropDraft.rect.x}
                  y={cropDraft.rect.y}
                  width={cropDraft.rect.width}
                  height={cropDraft.rect.height}
                  stroke={cropStroke}
                  strokeWidth={2 / zoom}
                  dash={[6 / zoom, 4 / zoom]}
                  listening={false}
                />
              </>
            )}
          </Layer>
        </Stage>
      )}

      {/* 크롭 적용/취소 */}
      {cropDraft && !cropDraft.dragging && (
        <div className={styles.cropActions}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              applyCrop(cropDraft.rect)
              setCropDraft(null)
            }}
          >
            잘라내기
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCropDraft(null)}>
            취소
          </Button>
        </div>
      )}

      <TextEditOverlay />
    </div>
  )
}
