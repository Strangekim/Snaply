/**
 * 좌표 변환·기하 유틸 — 순수 함수. 소유자: Editor.
 */
import type { Point, RectArea } from './types'

// 거의 무한에 가까운 확대/축소 범위 (2% ~ 6400%)
export const MIN_ZOOM = 0.02
export const MAX_ZOOM = 64

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** 두 점으로 정규화된 사각형(양수 너비/높이)을 만든다 */
export function normalizeRect(a: Point, b: Point): RectArea {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y)
  }
}

/** 사각형을 문서 경계 안으로 클램프 */
export function clampRectToBounds(rect: RectArea, docWidth: number, docHeight: number): RectArea {
  const x = Math.max(0, Math.min(rect.x, docWidth))
  const y = Math.max(0, Math.min(rect.y, docHeight))
  return {
    x,
    y,
    width: Math.max(0, Math.min(rect.width, docWidth - x)),
    height: Math.max(0, Math.min(rect.height, docHeight - y))
  }
}

/** 스테이지(화면) 좌표 → 문서 좌표 */
export function stageToDoc(p: Point, zoom: number, pan: Point): Point {
  return { x: (p.x - pan.x) / zoom, y: (p.y - pan.y) / zoom }
}

/** 문서 좌표 → 스테이지(화면) 좌표 */
export function docToStage(p: Point, zoom: number, pan: Point): Point {
  return { x: p.x * zoom + pan.x, y: p.y * zoom + pan.y }
}

/**
 * 포인터 위치를 고정점으로 줌을 변경했을 때의 새 pan을 계산한다.
 * (포인터 아래의 문서 좌표가 줌 전후 동일하게 유지되도록)
 */
export function zoomAtPoint(
  zoom: number,
  pan: Point,
  pointer: Point,
  nextZoomRaw: number
): { zoom: number; pan: Point } {
  const nextZoom = clampZoom(nextZoomRaw)
  const docPoint = stageToDoc(pointer, zoom, pan)
  return {
    zoom: nextZoom,
    pan: { x: pointer.x - docPoint.x * nextZoom, y: pointer.y - docPoint.y * nextZoom }
  }
}

/** 문서를 뷰포트 중앙에 맞추는 초기 줌/팬 계산 (여백 포함, 100% 초과 확대 안 함) */
export function fitToViewport(
  docWidth: number,
  docHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding = 32
): { zoom: number; pan: Point } {
  const availW = Math.max(1, viewportWidth - padding * 2)
  const availH = Math.max(1, viewportHeight - padding * 2)
  const zoom = clampZoom(Math.min(1, availW / docWidth, availH / docHeight))
  return {
    zoom,
    pan: {
      x: (viewportWidth - docWidth * zoom) / 2,
      y: (viewportHeight - docHeight * zoom) / 2
    }
  }
}

/** 점 배열([x0,y0,x1,y1,...])을 스케일 */
export function scalePoints(points: number[], scaleX: number, scaleY: number): number[] {
  return points.map((v, i) => (i % 2 === 0 ? v * scaleX : v * scaleY))
}

/**
 * 크롭 적용 시 새 절대 크롭 영역 계산.
 * rect는 현재 문서(이미 크롭됐다면 크롭된 좌표계) 기준, 반환은 원본 이미지 좌표계 기준.
 */
export function composeCrop(
  prevCrop: RectArea | null,
  rect: RectArea,
  imageWidth: number,
  imageHeight: number
): RectArea {
  const base = prevCrop ?? { x: 0, y: 0, width: imageWidth, height: imageHeight }
  const abs: RectArea = {
    x: base.x + rect.x,
    y: base.y + rect.y,
    width: rect.width,
    height: rect.height
  }
  // 원본 이미지 경계로 클램프
  const x = Math.max(0, Math.min(abs.x, imageWidth - 1))
  const y = Math.max(0, Math.min(abs.y, imageHeight - 1))
  return {
    x,
    y,
    width: Math.max(1, Math.min(abs.width, imageWidth - x)),
    height: Math.max(1, Math.min(abs.height, imageHeight - y))
  }
}
