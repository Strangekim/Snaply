/**
 * 문서 이미지 효과 — 경로 생성 순수 로직 테스트.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EFFECTS,
  flattenPadding,
  hasAnyEffect,
  hasClipEffects,
  normalizeEffects,
  traceEffectPath,
  zigzagEdgePoints,
  type PathCtx
} from '../../src/renderer/src/editor/effects'
import type { ImageEffects } from '../../src/renderer/src/editor/types'

const fx = (over: Partial<ImageEffects> = {}): ImageEffects => ({
  ...DEFAULT_EFFECTS,
  ...over,
  border: { ...DEFAULT_EFFECTS.border, ...over.border },
  shadow: { ...DEFAULT_EFFECTS.shadow, ...over.shadow },
  torn: { ...DEFAULT_EFFECTS.torn, ...over.torn }
})

describe('normalizeEffects', () => {
  it('undefined → 기본값 (모든 효과 꺼짐)', () => {
    const e = normalizeEffects(undefined)
    expect(e).toEqual(DEFAULT_EFFECTS)
    expect(hasAnyEffect(e)).toBe(false)
  })

  it('부분 상태를 완전한 객체로 채운다', () => {
    const e = normalizeEffects({ cornerRadius: 16 })
    expect(e.cornerRadius).toBe(16)
    expect(e.border.enabled).toBe(false)
    expect(e.torn).toEqual({ top: false, bottom: false, left: false, right: false })
  })
})

describe('hasClipEffects / flattenPadding', () => {
  it('라운드·찢김이 있으면 클리핑 필요', () => {
    expect(hasClipEffects(fx())).toBe(false)
    expect(hasClipEffects(fx({ cornerRadius: 8 }))).toBe(true)
    expect(hasClipEffects(fx({ torn: { top: true, bottom: false, left: false, right: false } }))).toBe(true)
  })

  it('그림자가 켜져 있을 때만 평탄화 여백이 생긴다', () => {
    expect(flattenPadding(undefined)).toBe(0)
    expect(flattenPadding(fx())).toBe(0)
    expect(flattenPadding(fx({ shadow: { enabled: true } }))).toBeGreaterThan(0)
  })
})

describe('zigzagEdgePoints', () => {
  it('끝점은 원래 변의 끝점과 일치한다', () => {
    const pts = zigzagEdgePoints(0, 0, 100, 0)
    expect(pts[pts.length - 2]).toBe(100)
    expect(pts[pts.length - 1]).toBe(0)
  })

  it('상단 변(좌→우)의 톱니는 아래(안쪽, +y)로 파인다', () => {
    const pts = zigzagEdgePoints(0, 0, 100, 0, 20, 5)
    const ys = []
    for (let i = 1; i < pts.length; i += 2) ys.push(pts[i])
    expect(Math.max(...ys)).toBe(5)
    expect(Math.min(...ys)).toBe(0)
  })

  it('우측 변(상→하)의 톱니는 왼쪽(안쪽, -x)으로 파인다', () => {
    const pts = zigzagEdgePoints(100, 0, 100, 80, 20, 5)
    const xs = []
    for (let i = 0; i < pts.length; i += 2) xs.push(pts[i])
    expect(Math.min(...xs)).toBe(95)
    expect(Math.max(...xs)).toBe(100)
  })

  it('변 길이에 비례해 톱니 수가 늘어난다', () => {
    const short = zigzagEdgePoints(0, 0, 40, 0, 16, 7)
    const long = zigzagEdgePoints(0, 0, 400, 0, 16, 7)
    expect(long.length).toBeGreaterThan(short.length)
  })
})

/** 호출 기록용 mock 컨텍스트 */
function mockCtx(): PathCtx & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    arcTo: () => calls.push('arcTo'),
    closePath: () => calls.push('closePath')
  }
}

describe('traceEffectPath', () => {
  it('효과 없음 → 단순 사각형 (moveTo + lineTo 4 + closePath, arcTo 없음)', () => {
    const ctx = mockCtx()
    traceEffectPath(ctx, 200, 100, fx())
    expect(ctx.calls.filter((c) => c === 'arcTo')).toHaveLength(0)
    expect(ctx.calls.filter((c) => c === 'lineTo')).toHaveLength(4)
    expect(ctx.calls[0]).toBe('moveTo')
    expect(ctx.calls[ctx.calls.length - 1]).toBe('closePath')
  })

  it('모서리 라운드 → 코너 4개에 arcTo', () => {
    const ctx = mockCtx()
    traceEffectPath(ctx, 200, 100, fx({ cornerRadius: 12 }))
    expect(ctx.calls.filter((c) => c === 'arcTo')).toHaveLength(4)
  })

  it('찢어진 변은 지그재그(lineTo 다수), 인접 코너의 라운드는 생략된다', () => {
    const ctx = mockCtx()
    traceEffectPath(
      ctx,
      200,
      100,
      fx({ cornerRadius: 12, torn: { top: true, bottom: false, left: false, right: false } })
    )
    // 위쪽 두 코너(TL, TR)는 라운드 생략 → 아래 두 코너만 arcTo
    expect(ctx.calls.filter((c) => c === 'arcTo')).toHaveLength(2)
    expect(ctx.calls.filter((c) => c === 'lineTo').length).toBeGreaterThan(4)
  })

  it('네 변 모두 찢김 → arcTo 없이 지그재그로만 순회한다', () => {
    const ctx = mockCtx()
    traceEffectPath(
      ctx,
      200,
      100,
      fx({ cornerRadius: 20, torn: { top: true, bottom: true, left: true, right: true } })
    )
    expect(ctx.calls.filter((c) => c === 'arcTo')).toHaveLength(0)
    expect(ctx.calls[ctx.calls.length - 1]).toBe('closePath')
  })
})
