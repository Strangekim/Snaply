import { describe, expect, it } from 'vitest'
import {
  ARROW_HEAD,
  FONT_SIZE,
  HIGHLIGHT_WIDTH,
  STEP_RADIUS,
  STROKE_WIDTH,
  applyStylePatch,
  appendDraftPoint,
  bakeTransform,
  baseName,
  cloneObject,
  createArrow,
  createCallout,
  createEllipse,
  createHighlight,
  createLine,
  createPen,
  createRect,
  createStep,
  createText,
  isDraftMeaningful,
  resizeDraft,
  strokeWidthFor,
  translateObject,
  withDefaultTail
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

describe('팩토리', () => {
  it('createArrow: 원점/색/굵기/머리 크기가 스타일 프리셋대로 설정된다', () => {
    const a = createArrow(P, style({ strokeLevel: 'L', headLevel: 'S', color: 'blue' }))
    expect(a.type).toBe('arrow')
    expect(a).toMatchObject({ x: 10, y: 20, rotation: 0, color: 'blue' })
    expect(a.points).toEqual([0, 0, 0, 0])
    expect(a.strokeWidth).toBe(STROKE_WIDTH.L)
    expect(a.headSize).toBe(ARROW_HEAD.S)
  })

  it('createRect/createEllipse: 0×0으로 시작하고 fillEnabled를 반영한다', () => {
    const r = createRect(P, style({ fillEnabled: true }))
    const e = createEllipse(P, style())
    expect(r).toMatchObject({ type: 'rect', width: 0, height: 0, fillEnabled: true })
    expect(e).toMatchObject({ type: 'ellipse', width: 0, height: 0, fillEnabled: false })
  })

  it('createText/createCallout: 빈 텍스트 + 폰트 프리셋으로 시작한다', () => {
    const t = createText(P, style({ fontLevel: 'L' }))
    const c = createCallout(P, style({ fontLevel: 'S' }))
    expect(t).toMatchObject({ type: 'text', text: '', fontSize: FONT_SIZE.L })
    expect(c).toMatchObject({ type: 'callout', text: '', fontSize: FONT_SIZE.S, width: 0, height: 0 })
  })

  it('createHighlight/createPen: 시작점 [0,0] 하나로 시작하고 형광펜은 넓은 굵기를 쓴다', () => {
    const h = createHighlight(P, style({ strokeLevel: 'S' }))
    const p = createPen(P, style({ strokeLevel: 'S' }))
    expect(h.points).toEqual([0, 0])
    expect(p.points).toEqual([0, 0])
    expect(h.strokeWidth).toBe(HIGHLIGHT_WIDTH.S)
    expect(p.strokeWidth).toBe(STROKE_WIDTH.S)
  })

  it('createStep: 전달된 값과 fontLevel 기반 반지름을 갖는다', () => {
    const s = createStep(P, 7, style({ fontLevel: 'L' }))
    expect(s).toMatchObject({ type: 'step', value: 7, radius: STEP_RADIUS.L })
  })

  it('팩토리는 매번 고유 id를 발급한다', () => {
    const ids = [createRect(P, style()).id, createRect(P, style()).id, createLine(P, style()).id]
    expect(new Set(ids).size).toBe(3)
    ids.forEach((id) => expect(id).toHaveLength(10))
  })

  it('strokeWidthFor: highlight만 HIGHLIGHT_WIDTH, 나머지는 STROKE_WIDTH를 쓴다', () => {
    expect(strokeWidthFor('highlight', 'M')).toBe(HIGHLIGHT_WIDTH.M)
    expect(strokeWidthFor('pen', 'M')).toBe(STROKE_WIDTH.M)
    expect(strokeWidthFor('rect', 'L')).toBe(STROKE_WIDTH.L)
  })
})

describe('resizeDraft', () => {
  it('arrow/line: 끝점을 시작점 기준 상대 좌표로 갱신한다', () => {
    const a = createArrow({ x: 100, y: 100 }, style())
    const resized = resizeDraft(a, { x: 100, y: 100 }, { x: 160, y: 130 })
    expect(resized.type).toBe('arrow')
    if (resized.type === 'arrow') expect(resized.points).toEqual([0, 0, 60, 30])
  })

  it('rect: 역방향(왼쪽 위로) 드래그 시 원점과 크기를 정규화한다', () => {
    const r = createRect({ x: 100, y: 100 }, style())
    const resized = resizeDraft(r, { x: 100, y: 100 }, { x: 40, y: 70 })
    expect(resized).toMatchObject({ x: 40, y: 70, width: 60, height: 30 })
  })

  it('드래그 리사이즈 대상이 아닌 타입(text)은 그대로 반환한다', () => {
    const t = createText(P, style())
    expect(resizeDraft(t, P, { x: 50, y: 50 })).toBe(t)
  })
})

describe('appendDraftPoint / isDraftMeaningful', () => {
  it('appendDraftPoint: 원점 기준 상대 좌표로 점을 누적한다', () => {
    const pen = createPen({ x: 10, y: 10 }, style())
    const next = appendDraftPoint(pen, { x: 10, y: 10 }, { x: 15, y: 22 })
    expect(next.points).toEqual([0, 0, 5, 12])
  })

  it('4px 미만 드래그의 arrow/rect는 무의미(폐기 대상)로 판정한다', () => {
    const a = resizeDraft(createArrow(P, style()), P, { x: 12, y: 21 })
    const r = resizeDraft(createRect(P, style()), P, { x: 13, y: 22 })
    expect(isDraftMeaningful(a)).toBe(false)
    expect(isDraftMeaningful(r)).toBe(false)
  })

  it('유의미한 크기의 드래프트와 클릭형 객체(text/step)는 유효하다', () => {
    const a = resizeDraft(createArrow(P, style()), P, { x: 40, y: 40 })
    const pen = appendDraftPoint(createPen(P, style()), P, { x: 30, y: 30 })
    expect(isDraftMeaningful(a)).toBe(true)
    expect(isDraftMeaningful(pen)).toBe(true)
    expect(isDraftMeaningful(createText(P, style()))).toBe(true)
    expect(isDraftMeaningful(createStep(P, 1, style()))).toBe(true)
  })
})

describe('translate / clone / tail', () => {
  it('translateObject: 위치만 이동하고 나머지 속성은 유지한다', () => {
    const r = createRect(P, style())
    const moved = translateObject(r, 5, -3)
    expect(moved.x).toBe(15)
    expect(moved.y).toBe(17)
    expect(moved.id).toBe(r.id)
  })

  it('cloneObject: 새 id + 기본 16px 오프셋으로 복제한다', () => {
    const r = createRect(P, style())
    const c = cloneObject(r)
    expect(c.id).not.toBe(r.id)
    expect(c.x).toBe(r.x + 16)
    expect(c.y).toBe(r.y + 16)
  })

  it('withDefaultTail: 말풍선 아래 바깥쪽으로 꼬리를 배치한다', () => {
    const c = { ...createCallout(P, style()), width: 200, height: 100 }
    const tailed = withDefaultTail(c)
    expect(tailed.tailX).toBe(40) // max(16, 200*0.2)
    expect(tailed.tailY).toBe(135) // 100 + max(20, 35)
  })
})

describe('bakeTransform', () => {
  const t = (over: Partial<Parameters<typeof bakeTransform>[1]> = {}) => ({
    x: 50,
    y: 60,
    rotation: 45,
    scaleX: 2,
    scaleY: 3,
    ...over
  })

  it('rect: scale을 width/height에 굽고 위치/회전을 반영한다', () => {
    const r = { ...createRect(P, style()), width: 100, height: 40 }
    const baked = bakeTransform(r, t())
    expect(baked).toMatchObject({ x: 50, y: 60, rotation: 45, width: 200, height: 120 })
  })

  it('rect: 극단적으로 줄여도 최소 4px을 보장한다', () => {
    const r = { ...createRect(P, style()), width: 100, height: 40 }
    const baked = bakeTransform(r, t({ scaleX: 0.001, scaleY: 0.001 }))
    if (baked.type === 'rect') {
      expect(baked.width).toBe(4)
      expect(baked.height).toBe(4)
    }
  })

  it('text: scaleY를 fontSize에 굽는다 (최소 8px)', () => {
    const txt = createText(P, style()) // fontSize M = 18
    const baked = bakeTransform(txt, t({ scaleY: 2 }))
    if (baked.type === 'text') expect(baked.fontSize).toBe(36)
    const tiny = bakeTransform(txt, t({ scaleY: 0.01 }))
    if (tiny.type === 'text') expect(tiny.fontSize).toBe(8)
  })

  it('step: 두 축 중 큰 배율을 radius에 굽는다', () => {
    const s = createStep(P, 1, style()) // radius M = 16
    const baked = bakeTransform(s, t({ scaleX: 0.5, scaleY: 2 }))
    if (baked.type === 'step') expect(baked.radius).toBe(32)
  })

  it('line/callout: points와 꼬리 좌표를 배율대로 스케일한다', () => {
    const l = { ...createLine(P, style()), points: [0, 0, 10, 20] }
    const bakedLine = bakeTransform(l, t({ scaleX: 2, scaleY: 0.5 }))
    if (bakedLine.type === 'line') expect(bakedLine.points).toEqual([0, 0, 20, 10])

    const c = { ...createCallout(P, style()), width: 100, height: 50, tailX: 20, tailY: 70 }
    const bakedCallout = bakeTransform(c, t({ scaleX: 2, scaleY: 2 }))
    if (bakedCallout.type === 'callout') {
      expect(bakedCallout).toMatchObject({ width: 200, height: 100, tailX: 40, tailY: 140 })
    }
  })
})

describe('applyStylePatch', () => {
  it('color 패치는 모든 타입에 적용된다', () => {
    const r = createRect(P, style())
    expect(applyStylePatch(r, { color: 'green' }).color).toBe('green')
  })

  it('strokeLevel: highlight는 HIGHLIGHT_WIDTH, 그 외는 STROKE_WIDTH로 변환된다', () => {
    const h = applyStylePatch(createHighlight(P, style()), { strokeLevel: 'L' })
    const a = applyStylePatch(createArrow(P, style()), { strokeLevel: 'L' })
    if (h.type === 'highlight') expect(h.strokeWidth).toBe(HIGHLIGHT_WIDTH.L)
    if (a.type === 'arrow') expect(a.strokeWidth).toBe(STROKE_WIDTH.L)
  })

  it('fontLevel: text/callout은 fontSize, step은 radius에 반영된다', () => {
    const txt = applyStylePatch(createText(P, style()), { fontLevel: 'S' })
    const step = applyStylePatch(createStep(P, 1, style()), { fontLevel: 'L' })
    if (txt.type === 'text') expect(txt.fontSize).toBe(FONT_SIZE.S)
    if (step.type === 'step') expect(step.radius).toBe(STEP_RADIUS.L)
  })

  it('headLevel은 arrow에만, fillEnabled는 rect/ellipse에만 적용된다', () => {
    const a = applyStylePatch(createArrow(P, style()), { headLevel: 'L' })
    if (a.type === 'arrow') expect(a.headSize).toBe(ARROW_HEAD.L)

    const line = createLine(P, style())
    expect(applyStylePatch(line, { headLevel: 'L' })).toEqual(line)

    const e = applyStylePatch(createEllipse(P, style()), { fillEnabled: true })
    if (e.type === 'ellipse') expect(e.fillEnabled).toBe(true)
    const txt = createText(P, style())
    expect(applyStylePatch(txt, { fillEnabled: true })).toEqual(txt)
  })

  it('무관한 패치만 있으면 객체가 참조 그대로 반환된다 (불변 최적화)', () => {
    const txt = createText(P, style())
    expect(applyStylePatch(txt, { strokeLevel: 'L', headLevel: 'L', fillEnabled: true })).toBe(txt)
  })
})

describe('baseName', () => {
  it('Windows/Unix 경로 모두에서 파일명만 추출한다', () => {
    expect(baseName('C:\\Users\\me\\shot.png')).toBe('shot.png')
    expect(baseName('/home/me/shot.png')).toBe('shot.png')
    expect(baseName('shot.png')).toBe('shot.png')
  })
})
