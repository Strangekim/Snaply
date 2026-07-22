/**
 * Phase 3 신규 객체(블러/스포트라이트/돋보기/스탬프/이미지/프레임) 로직 테스트.
 */
import { describe, expect, it } from 'vitest'
import {
  BLUR_INTENSITY,
  STAMP_SIZE,
  bakeTransform,
  createBlur,
  createBlurArea,
  createFrame,
  createImage,
  createMagnify,
  createRect,
  createSpotlight,
  createStamp,
  createStep,
  isDraftMeaningful,
  objectBounds,
  rectsIntersect,
  resizeDraft,
  applyStylePatch
} from '../../src/renderer/src/editor/objects'
import type { StyleSettings } from '../../src/renderer/src/editor/types'

const style = (over: Partial<StyleSettings> = {}): StyleSettings => ({
  color: 'red',
  strokeLevel: 'M',
  fontLevel: 'M',
  headLevel: 'M',
  fillEnabled: false,
  ...over
})

const P = { x: 10, y: 20 }

describe('Phase 3 팩토리', () => {
  it('createBlur: 스타일의 모드/강도를 반영하고 기본값은 mosaic M', () => {
    const b1 = createBlur(P, style())
    expect(b1).toMatchObject({ type: 'blur', mode: 'mosaic', intensity: BLUR_INTENSITY.M })
    const b2 = createBlur(P, style({ blurMode: 'blur', blurLevel: 'L' }))
    expect(b2).toMatchObject({ mode: 'blur', intensity: BLUR_INTENSITY.L })
  })

  it('createBlurArea: 영역이 미리 정해진 블러를 만든다 (리댁션용)', () => {
    const b = createBlurArea({ x: 5, y: 6, width: 70, height: 20 }, 'mosaic', 8)
    expect(b).toMatchObject({ type: 'blur', x: 5, y: 6, width: 70, height: 20, mode: 'mosaic', intensity: 8 })
    expect(b.id).toHaveLength(10)
  })

  it('createSpotlight/createMagnify/createStamp: 스타일 기본값을 반영한다', () => {
    const sp = createSpotlight(P, style({ spotlightShape: 'ellipse' }))
    expect(sp).toMatchObject({ type: 'spotlight', shape: 'ellipse', width: 0, height: 0 })
    const mg = createMagnify(P, style({ magnifyScale: 3 }))
    expect(mg).toMatchObject({ type: 'magnify', scale: 3 })
    expect(mg.radius).toBeGreaterThan(0)
    const st = createStamp(P, 'star', style({ fontLevel: 'L' }))
    expect(st).toMatchObject({ type: 'stamp', kind: 'star', size: STAMP_SIZE.L })
  })

  it('createImage/createFrame: 크기와 라벨을 유지한다', () => {
    const img = createImage(P, 120, 80, 'data:image/png;base64,x')
    expect(img).toMatchObject({ type: 'image', width: 120, height: 80, src: 'data:image/png;base64,x' })
    const fr = createFrame({ x: 1, y: 2, width: 300, height: 200 }, '여기에 붙여넣기')
    expect(fr).toMatchObject({ type: 'frame', x: 1, y: 2, width: 300, height: 200, label: '여기에 붙여넣기' })
  })
})

describe('드래프트 — blur/spotlight', () => {
  it('resizeDraft가 rect처럼 정규화한다', () => {
    const b = createBlur({ x: 100, y: 100 }, style())
    const resized = resizeDraft(b, { x: 100, y: 100 }, { x: 40, y: 160 })
    expect(resized).toMatchObject({ x: 40, y: 100, width: 60, height: 60 })
  })

  it('4px 미만이면 무의미로 판정한다', () => {
    const b = resizeDraft(createBlur(P, style()), P, { x: 12, y: 21 })
    expect(isDraftMeaningful(b)).toBe(false)
    const sp = resizeDraft(createSpotlight(P, style()), P, { x: 100, y: 100 })
    expect(isDraftMeaningful(sp)).toBe(true)
  })
})

describe('bakeTransform — Phase 3', () => {
  const t = { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 3 }

  it('blur/spotlight/image/frame: scale을 width/height에 굽는다', () => {
    const b = { ...createBlur(P, style()), width: 50, height: 40 }
    expect(bakeTransform(b, t)).toMatchObject({ width: 100, height: 120 })
    const img = createImage(P, 10, 10, 'data:x')
    expect(bakeTransform(img, t)).toMatchObject({ width: 20, height: 30 })
  })

  it('magnify: 두 축 중 큰 배율을 radius에 굽는다 (최소 16)', () => {
    const mg = createMagnify(P, style()) // radius 60
    const baked = bakeTransform(mg, t)
    if (baked.type === 'magnify') expect(baked.radius).toBe(180)
    const tiny = bakeTransform(mg, { ...t, scaleX: 0.01, scaleY: 0.01 })
    if (tiny.type === 'magnify') expect(tiny.radius).toBe(16)
  })

  it('stamp: 두 축 중 큰 배율을 size에 굽는다 (최소 12)', () => {
    const st = createStamp(P, 'check', style()) // size M = 48
    const baked = bakeTransform(st, t)
    if (baked.type === 'stamp') expect(baked.size).toBe(144)
  })
})

describe('applyStylePatch — Phase 3', () => {
  it('blurMode/blurLevel은 blur에만 적용된다', () => {
    const b = createBlur(P, style())
    const patched = applyStylePatch(b, { blurMode: 'blur', blurLevel: 'S' })
    expect(patched).toMatchObject({ mode: 'blur', intensity: BLUR_INTENSITY.S })
    const r = createRect(P, style())
    expect(applyStylePatch(r, { blurMode: 'blur' })).toBe(r)
  })

  it('spotlightShape/magnifyScale은 해당 타입에만 적용된다', () => {
    const sp = applyStylePatch(createSpotlight(P, style()), { spotlightShape: 'ellipse' })
    if (sp.type === 'spotlight') expect(sp.shape).toBe('ellipse')
    const mg = applyStylePatch(createMagnify(P, style()), { magnifyScale: 4 })
    if (mg.type === 'magnify') expect(mg.scale).toBe(4)
  })

  it('fontLevel은 stamp의 size를 바꾼다', () => {
    const st = applyStylePatch(createStamp(P, 'heart', style()), { fontLevel: 'S' })
    if (st.type === 'stamp') expect(st.size).toBe(STAMP_SIZE.S)
  })
})

describe('objectBounds / rectsIntersect (마키 선택)', () => {
  it('사각형류: x,y,width,height 그대로', () => {
    const r = { ...createRect({ x: 10, y: 20 }, style()), width: 100, height: 50 }
    expect(objectBounds(r)).toEqual({ x: 10, y: 20, width: 100, height: 50 })
  })

  it('90도 회전한 사각형은 폭/높이가 뒤바뀐다', () => {
    const r = { ...createRect({ x: 0, y: 0 }, style()), width: 100, height: 50, rotation: 90 }
    const b = objectBounds(r)
    expect(Math.round(b.width)).toBe(50)
    expect(Math.round(b.height)).toBe(100)
  })

  it('선류: points의 min/max + 원점 오프셋', () => {
    const line = {
      id: 'l1',
      x: 10,
      y: 20,
      rotation: 0,
      color: 'red' as const,
      type: 'line' as const,
      points: [0, 0, 60, -30],
      strokeWidth: 4
    }
    expect(objectBounds(line)).toEqual({ x: 10, y: -10, width: 60, height: 30 })
  })

  it('중심 기준 객체(step/magnify/stamp)는 중심에서 대칭이다', () => {
    const s = createStep({ x: 100, y: 100 }, 1, style()) // radius M = 16
    expect(objectBounds(s)).toEqual({ x: 84, y: 84, width: 32, height: 32 })
    const st = createStamp({ x: 50, y: 50 }, 'check', style()) // size 48
    expect(objectBounds(st)).toEqual({ x: 26, y: 26, width: 48, height: 48 })
  })

  it('rectsIntersect: 겹침/모서리 접촉/분리 판정', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true)
    expect(rectsIntersect(a, { x: 10, y: 10, width: 5, height: 5 })).toBe(true) // 경계 접촉
    expect(rectsIntersect(a, { x: 11, y: 0, width: 5, height: 5 })).toBe(false)
  })
})
