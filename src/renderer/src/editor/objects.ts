/**
 * 주석 객체 팩토리 + 불변 갱신 헬퍼 — 순수 로직. 소유자: Editor.
 */
import { nanoid } from 'nanoid'
import { scalePoints } from './geometry'
import type {
  AnnoObject,
  ArrowObj,
  CalloutObj,
  ColorId,
  EllipseObj,
  HighlightObj,
  LineObj,
  PenObj,
  Point,
  RectObj,
  SizeLevel,
  StepObj,
  StyleSettings,
  TextObj
} from './types'

// ───────────── 크기 프리셋 (S/M/L → px) ─────────────

export const STROKE_WIDTH: Record<SizeLevel, number> = { S: 2, M: 4, L: 7 }
export const HIGHLIGHT_WIDTH: Record<SizeLevel, number> = { S: 12, M: 20, L: 28 }
export const FONT_SIZE: Record<SizeLevel, number> = { S: 14, M: 18, L: 26 }
export const STEP_RADIUS: Record<SizeLevel, number> = { S: 12, M: 16, L: 22 }
export const ARROW_HEAD: Record<SizeLevel, number> = { S: 8, M: 14, L: 22 }

/** 객체 종류별로 굵기 레벨을 실제 px로 변환 */
export function strokeWidthFor(type: AnnoObject['type'], level: SizeLevel): number {
  return type === 'highlight' ? HIGHLIGHT_WIDTH[level] : STROKE_WIDTH[level]
}

export const HIGHLIGHT_OPACITY = 0.55
export const CALLOUT_PADDING = 12
export const CALLOUT_RADIUS = 12

// ───────────── 팩토리 ─────────────

export const newId = (): string => nanoid(10)

interface BaseInit {
  x: number
  y: number
  color: ColorId
}

const base = (p: Point, color: ColorId): BaseInit & { id: string; rotation: number } => ({
  id: newId(),
  x: p.x,
  y: p.y,
  rotation: 0,
  color
})

export function createArrow(start: Point, style: StyleSettings): ArrowObj {
  return {
    ...base(start, style.color),
    type: 'arrow',
    points: [0, 0, 0, 0],
    strokeWidth: STROKE_WIDTH[style.strokeLevel],
    headSize: ARROW_HEAD[style.headLevel]
  }
}

export function createLine(start: Point, style: StyleSettings): LineObj {
  return {
    ...base(start, style.color),
    type: 'line',
    points: [0, 0, 0, 0],
    strokeWidth: STROKE_WIDTH[style.strokeLevel]
  }
}

export function createRect(start: Point, style: StyleSettings): RectObj {
  return {
    ...base(start, style.color),
    type: 'rect',
    width: 0,
    height: 0,
    strokeWidth: STROKE_WIDTH[style.strokeLevel],
    fillEnabled: style.fillEnabled
  }
}

export function createEllipse(start: Point, style: StyleSettings): EllipseObj {
  return {
    ...base(start, style.color),
    type: 'ellipse',
    width: 0,
    height: 0,
    strokeWidth: STROKE_WIDTH[style.strokeLevel],
    fillEnabled: style.fillEnabled
  }
}

export function createText(at: Point, style: StyleSettings): TextObj {
  return {
    ...base(at, style.color),
    type: 'text',
    text: '',
    fontSize: FONT_SIZE[style.fontLevel]
  }
}

export function createCallout(start: Point, style: StyleSettings): CalloutObj {
  return {
    ...base(start, style.color),
    type: 'callout',
    width: 0,
    height: 0,
    text: '',
    fontSize: FONT_SIZE[style.fontLevel],
    tailX: 24,
    tailY: 0
  }
}

/** 드래그가 끝났을 때 말풍선 기본 꼬리 위치(왼쪽 아래 바깥) 부여 */
export function withDefaultTail(callout: CalloutObj): CalloutObj {
  return {
    ...callout,
    tailX: Math.max(16, callout.width * 0.2),
    tailY: callout.height + Math.max(20, callout.height * 0.35)
  }
}

export function createHighlight(start: Point, style: StyleSettings): HighlightObj {
  return {
    ...base(start, style.color),
    type: 'highlight',
    points: [0, 0],
    strokeWidth: HIGHLIGHT_WIDTH[style.strokeLevel]
  }
}

export function createPen(start: Point, style: StyleSettings): PenObj {
  return {
    ...base(start, style.color),
    type: 'pen',
    points: [0, 0],
    strokeWidth: STROKE_WIDTH[style.strokeLevel]
  }
}

export function createStep(at: Point, value: number, style: StyleSettings): StepObj {
  return {
    ...base(at, style.color),
    type: 'step',
    value,
    radius: STEP_RADIUS[style.fontLevel]
  }
}

// ───────────── 갱신 헬퍼 ─────────────

/** 드래그 중 도형 크기 갱신 (draft 전용) */
export function resizeDraft(obj: AnnoObject, start: Point, current: Point): AnnoObject {
  const dx = current.x - start.x
  const dy = current.y - start.y
  switch (obj.type) {
    case 'arrow':
    case 'line':
      return { ...obj, points: [0, 0, dx, dy] }
    case 'rect':
    case 'ellipse':
    case 'callout':
      return {
        ...obj,
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(dx),
        height: Math.abs(dy)
      }
    default:
      return obj
  }
}

/** 자유곡선/형광펜 점 추가 (draft 전용) */
export function appendDraftPoint(
  obj: HighlightObj | PenObj,
  origin: Point,
  current: Point
): HighlightObj | PenObj {
  return { ...obj, points: [...obj.points, current.x - origin.x, current.y - origin.y] }
}

/** 드래그가 유의미한 크기인지 (아니면 draft 폐기) */
export function isDraftMeaningful(obj: AnnoObject): boolean {
  switch (obj.type) {
    case 'arrow':
    case 'line': {
      const [, , dx, dy] = obj.points
      return Math.hypot(dx ?? 0, dy ?? 0) >= 4
    }
    case 'rect':
    case 'ellipse':
    case 'callout':
      return obj.width >= 4 && obj.height >= 4
    case 'highlight':
    case 'pen':
      return obj.points.length >= 4
    default:
      return true
  }
}

/** 객체 이동 */
export function translateObject<T extends AnnoObject>(obj: T, dx: number, dy: number): T {
  return { ...obj, x: obj.x + dx, y: obj.y + dy }
}

/** 복제 (새 id + 살짝 오프셋) */
export function cloneObject(obj: AnnoObject, offset = 16): AnnoObject {
  return { ...obj, id: newId(), x: obj.x + offset, y: obj.y + offset }
}

/** Konva Transformer 종료 시 노드 attrs를 plain object에 굽는다 (scale은 항상 1로 환원) */
export interface NodeTransform {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export function bakeTransform(obj: AnnoObject, t: NodeTransform): AnnoObject {
  const moved = { ...obj, x: t.x, y: t.y, rotation: t.rotation }
  switch (moved.type) {
    case 'rect':
    case 'ellipse':
      return {
        ...moved,
        width: Math.max(4, moved.width * t.scaleX),
        height: Math.max(4, moved.height * t.scaleY)
      }
    case 'callout':
      return {
        ...moved,
        width: Math.max(24, moved.width * t.scaleX),
        height: Math.max(24, moved.height * t.scaleY),
        tailX: moved.tailX * t.scaleX,
        tailY: moved.tailY * t.scaleY
      }
    case 'text':
      return { ...moved, fontSize: Math.max(8, moved.fontSize * t.scaleY) }
    case 'step':
      return { ...moved, radius: Math.max(6, moved.radius * Math.max(t.scaleX, t.scaleY)) }
    case 'arrow':
    case 'line':
    case 'highlight':
    case 'pen':
      return { ...moved, points: scalePoints(moved.points, t.scaleX, t.scaleY) }
    default:
      return moved
  }
}

/**
 * 스타일 패치를 객체 종류에 맞게 적용.
 * Phase 3의 "같은 종류 일괄 변경"도 이 함수를 그대로 재사용하면 된다.
 */
export function applyStylePatch(obj: AnnoObject, patch: Partial<StyleSettings>): AnnoObject {
  let next: AnnoObject = obj
  if (patch.color !== undefined) {
    next = { ...next, color: patch.color }
  }
  if (patch.strokeLevel !== undefined && 'strokeWidth' in next) {
    next = { ...next, strokeWidth: strokeWidthFor(next.type, patch.strokeLevel) }
  }
  if (patch.fontLevel !== undefined) {
    if (next.type === 'text' || next.type === 'callout') {
      next = { ...next, fontSize: FONT_SIZE[patch.fontLevel] }
    } else if (next.type === 'step') {
      next = { ...next, radius: STEP_RADIUS[patch.fontLevel] }
    }
  }
  if (patch.headLevel !== undefined && next.type === 'arrow') {
    next = { ...next, headSize: ARROW_HEAD[patch.headLevel] }
  }
  if (patch.fillEnabled !== undefined && (next.type === 'rect' || next.type === 'ellipse')) {
    next = { ...next, fillEnabled: patch.fillEnabled }
  }
  return next
}

/** 파일 경로에서 파일명만 추출 */
export function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/)
  return parts[parts.length - 1] || filePath
}
