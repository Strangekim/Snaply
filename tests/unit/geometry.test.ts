import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampRectToBounds,
  clampZoom,
  composeCrop,
  docToStage,
  fitToViewport,
  normalizeRect,
  scalePoints,
  stageToDoc,
  zoomAtPoint
} from '../../src/renderer/src/editor/geometry'

describe('clampZoom', () => {
  it('범위 안 값은 그대로, 벗어나면 MIN/MAX로 클램프한다', () => {
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
  })
})

describe('normalizeRect', () => {
  it('오른쪽 아래로 드래그하면 그대로의 사각형을 만든다', () => {
    expect(normalizeRect({ x: 10, y: 20 }, { x: 60, y: 90 })).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 70
    })
  })

  it('왼쪽 위로 역방향 드래그해도 양수 너비/높이로 정규화된다', () => {
    expect(normalizeRect({ x: 60, y: 90 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 70
    })
  })

  it('같은 점이면 0×0 사각형이 된다', () => {
    expect(normalizeRect({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({
      x: 5,
      y: 5,
      width: 0,
      height: 0
    })
  })
})

describe('clampRectToBounds', () => {
  it('경계 안 사각형은 변경되지 않는다', () => {
    const r = { x: 10, y: 10, width: 30, height: 30 }
    expect(clampRectToBounds(r, 100, 100)).toEqual(r)
  })

  it('음수 원점은 0으로, 넘치는 크기는 경계까지 잘린다', () => {
    expect(clampRectToBounds({ x: -20, y: -5, width: 300, height: 40 }, 100, 100)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 40
    })
  })

  it('원점이 경계 밖(오른쪽 아래)이면 크기가 0으로 잘린다', () => {
    const r = clampRectToBounds({ x: 150, y: 150, width: 50, height: 50 }, 100, 100)
    expect(r.x).toBe(100)
    expect(r.y).toBe(100)
    expect(r.width).toBe(0)
    expect(r.height).toBe(0)
  })
})

describe('stageToDoc / docToStage', () => {
  it('서로 역변환이다 (라운드트립)', () => {
    const zoom = 1.5
    const pan = { x: 40, y: -20 }
    const p = { x: 123, y: 456 }
    const round = docToStage(stageToDoc(p, zoom, pan), zoom, pan)
    expect(round.x).toBeCloseTo(p.x)
    expect(round.y).toBeCloseTo(p.y)
  })

  it('zoom=1, pan=0이면 항등 변환이다', () => {
    expect(stageToDoc({ x: 7, y: 9 }, 1, { x: 0, y: 0 })).toEqual({ x: 7, y: 9 })
    expect(docToStage({ x: 7, y: 9 }, 1, { x: 0, y: 0 })).toEqual({ x: 7, y: 9 })
  })
})

describe('zoomAtPoint', () => {
  it('포인터 아래의 문서 좌표가 줌 전후 동일하게 유지된다', () => {
    const zoom = 1
    const pan = { x: 0, y: 0 }
    const pointer = { x: 200, y: 150 }
    const before = stageToDoc(pointer, zoom, pan)
    const next = zoomAtPoint(zoom, pan, pointer, 2)
    const after = stageToDoc(pointer, next.zoom, next.pan)
    expect(next.zoom).toBe(2)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('요청 줌이 범위를 벗어나면 클램프된 줌으로 pan을 계산한다', () => {
    const next = zoomAtPoint(1, { x: 10, y: 10 }, { x: 50, y: 50 }, 100)
    expect(next.zoom).toBe(MAX_ZOOM)
    const after = stageToDoc({ x: 50, y: 50 }, next.zoom, next.pan)
    const before = stageToDoc({ x: 50, y: 50 }, 1, { x: 10, y: 10 })
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
})

describe('fitToViewport', () => {
  it('큰 문서는 여백을 고려해 축소되고 중앙 정렬된다', () => {
    const { zoom, pan } = fitToViewport(2000, 1000, 1032, 532, 16)
    // avail = 1000×500 → zoom = min(1, 0.5, 0.5) = 0.5
    expect(zoom).toBe(0.5)
    expect(pan.x).toBeCloseTo((1032 - 2000 * 0.5) / 2)
    expect(pan.y).toBeCloseTo((532 - 1000 * 0.5) / 2)
  })

  it('작은 문서는 100%를 초과해 확대하지 않는다', () => {
    const { zoom, pan } = fitToViewport(100, 100, 1000, 800)
    expect(zoom).toBe(1)
    expect(pan).toEqual({ x: 450, y: 350 })
  })

  it('아주 큰 문서라도 줌은 MIN_ZOOM 밑으로 내려가지 않는다', () => {
    const { zoom } = fitToViewport(100000, 100000, 800, 600)
    expect(zoom).toBe(MIN_ZOOM)
  })
})

describe('scalePoints', () => {
  it('짝수 인덱스는 x배율, 홀수 인덱스는 y배율로 스케일한다', () => {
    expect(scalePoints([1, 2, 3, 4], 2, 10)).toEqual([2, 20, 6, 40])
  })

  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(scalePoints([], 3, 3)).toEqual([])
  })
})

describe('composeCrop', () => {
  it('첫 크롭: rect가 그대로 원본 좌표계 크롭이 된다', () => {
    expect(composeCrop(null, { x: 10, y: 20, width: 300, height: 200 }, 800, 600)).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200
    })
  })

  it('연속 크롭: 이전 크롭 좌표계 기준 rect를 원본 좌표계로 합성한다', () => {
    const prev = { x: 100, y: 50, width: 400, height: 300 }
    expect(composeCrop(prev, { x: 30, y: 40, width: 200, height: 100 }, 800, 600)).toEqual({
      x: 130,
      y: 90,
      width: 200,
      height: 100
    })
  })

  it('원본 경계를 넘는 크롭은 이미지 안으로 클램프된다', () => {
    const result = composeCrop(null, { x: 700, y: 500, width: 500, height: 500 }, 800, 600)
    expect(result.x).toBe(700)
    expect(result.y).toBe(500)
    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
  })

  it('결과 크롭은 최소 1×1을 보장한다', () => {
    const result = composeCrop(null, { x: 799, y: 599, width: 0, height: 0 }, 800, 600)
    expect(result.width).toBeGreaterThanOrEqual(1)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })
})
