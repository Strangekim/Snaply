/**
 * 문서 전체 이미지 효과 — 테두리/그림자/라운드/찢어진 가장자리. 소유자: Editor.
 * 경로 생성은 순수 로직 (ctx는 최소 인터페이스만 사용 → 테스트 가능).
 */
import type { ImageEffects } from './types'

export const DEFAULT_EFFECTS: ImageEffects = {
  border: { enabled: false, color: 'black', width: 4 },
  shadow: { enabled: false },
  cornerRadius: 0,
  torn: { top: false, bottom: false, left: false, right: false }
}

/** 부분 상태(구버전 문서 포함)를 완전한 효과 객체로 정규화 */
export function normalizeEffects(e?: Partial<ImageEffects> | null): ImageEffects {
  if (!e) return DEFAULT_EFFECTS
  return {
    border: { ...DEFAULT_EFFECTS.border, ...e.border },
    shadow: { ...DEFAULT_EFFECTS.shadow, ...e.shadow },
    cornerRadius: e.cornerRadius ?? 0,
    torn: { ...DEFAULT_EFFECTS.torn, ...e.torn }
  }
}

/** 배경 클리핑(라운드/찢김)이 필요한가 */
export function hasClipEffects(e: ImageEffects): boolean {
  return e.cornerRadius > 0 || e.torn.top || e.torn.bottom || e.torn.left || e.torn.right
}

/** 효과가 하나라도 켜져 있는가 */
export function hasAnyEffect(e: ImageEffects): boolean {
  return e.border.enabled || e.shadow.enabled || hasClipEffects(e)
}

/** 평탄화 시 문서 주변에 필요한 여백(px) — 그림자가 잘리지 않도록 */
export function flattenPadding(e?: Partial<ImageEffects> | null): number {
  return normalizeEffects(e).shadow.enabled ? 28 : 0
}

export const TORN_TOOTH = 16
export const TORN_AMP = 7

/**
 * (x0,y0)→(x1,y1) 변을 지그재그로 쪼갠 점 배열 [x,y,...].
 * 시작점은 제외, 끝점은 포함. 톱니는 법선 (-dy,dx) 방향(시계 방향 순회 시 사각형 안쪽)으로 파인다.
 */
export function zigzagEdgePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tooth = TORN_TOOTH,
  amp = TORN_AMP
): number[] {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  if (len < 1) return [x1, y1]
  const teeth = Math.max(1, Math.round(len / tooth))
  const segs = teeth * 2
  const nx = -dy / len
  const ny = dx / len
  const pts: number[] = []
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const off = i === segs ? 0 : i % 2 === 1 ? amp : 0
    pts.push(x0 + dx * t + nx * off, y0 + dy * t + ny * off)
  }
  return pts
}

/** traceEffectPath가 요구하는 최소 컨텍스트 (CanvasRenderingContext2D 호환) */
export interface PathCtx {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void
  closePath(): void
}

/**
 * 문서(0,0)~(w,h) 외곽 경로를 효과에 맞게 그린다 (시계 방향).
 * 찢어진 변은 지그재그, 아니면 직선 + 인접 변이 온전할 때만 코너 라운드.
 */
export function traceEffectPath(ctx: PathCtx, w: number, h: number, e: ImageEffects): void {
  const r = Math.max(0, Math.min(e.cornerRadius, w / 2, h / 2))
  const rTL = e.torn.top || e.torn.left ? 0 : r
  const rTR = e.torn.top || e.torn.right ? 0 : r
  const rBR = e.torn.bottom || e.torn.right ? 0 : r
  const rBL = e.torn.bottom || e.torn.left ? 0 : r

  const edge = (x0: number, y0: number, x1: number, y1: number, torn: boolean): void => {
    if (!torn) {
      ctx.lineTo(x1, y1)
      return
    }
    const pts = zigzagEdgePoints(x0, y0, x1, y1)
    for (let i = 0; i + 1 < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
  }

  ctx.moveTo(rTL, 0)
  edge(rTL, 0, w - rTR, 0, e.torn.top)
  if (rTR > 0) ctx.arcTo(w, 0, w, rTR, rTR)
  edge(w, rTR, w, h - rBR, e.torn.right)
  if (rBR > 0) ctx.arcTo(w, h, w - rBR, h, rBR)
  edge(w - rBR, h, rBL, h, e.torn.bottom)
  if (rBL > 0) ctx.arcTo(0, h, 0, h - rBL, rBL)
  edge(0, h - rBL, 0, rTL, e.torn.left)
  if (rTL > 0) ctx.arcTo(0, 0, rTL, 0, rTL)
  ctx.closePath()
}
