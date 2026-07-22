import { describe, expect, it } from 'vitest'
import {
  computeRowProfile,
  detectFixedTop,
  findOverlapOffset,
  framesAlmostIdentical,
  stitchFrames,
  type StitchFrame
} from '../../src/main/capture/stitch'

// ─────────────── 합성 이미지 헬퍼 ───────────────

/** 결정적 PRNG (mulberry32) — 테스트 재현성 보장 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** width×height 랜덤 RGBA 패턴 생성 */
function makePattern(width: number, height: number, seed = 42): Uint8Array {
  const rnd = mulberry32(seed)
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(rnd() * 256)
    data[i + 1] = Math.floor(rnd() * 256)
    data[i + 2] = Math.floor(rnd() * 256)
    data[i + 3] = 255
  }
  return data
}

/** 패턴에서 [from, to) 행 구간을 잘라 프레임으로 만든다 */
function sliceRows(pattern: Uint8Array, width: number, from: number, to: number): StitchFrame {
  return {
    data: pattern.slice(from * width * 4, to * width * 4),
    width,
    height: to - from
  }
}

/** 여러 픽셀 버퍼를 세로로 이어붙인 프레임 */
function concatRows(width: number, ...chunks: Uint8Array[]): StitchFrame {
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const data = new Uint8Array(total)
  let pos = 0
  for (const c of chunks) {
    data.set(c, pos)
    pos += c.length
  }
  return { data, width, height: total / (width * 4) }
}

const W = 100

// ─────────────── 테스트 ───────────────

describe('findOverlapOffset', () => {
  it('20px 겹침(오프셋 30)을 정확히 찾는다', () => {
    const base = makePattern(W, 140)
    const a = sliceRows(base, W, 0, 50)
    const b = sliceRows(base, W, 30, 80)
    const pa = computeRowProfile(a)
    const pb = computeRowProfile(b)
    const { offset, score } = findOverlapOffset(pa, pb, 50, 0)
    expect(offset).toBe(30)
    expect(score).toBeLessThan(0.5)
  })

  it('동일 프레임 쌍은 오프셋 0을 반환한다 (종료 신호)', () => {
    const base = makePattern(W, 60)
    const a = sliceRows(base, W, 0, 50)
    const pa = computeRowProfile(a)
    const { offset } = findOverlapOffset(pa, pa, 50, 0)
    expect(offset).toBe(0)
  })
})

describe('stitchFrames', () => {
  it('100×50 프레임 3장(20px 겹침)을 높이 110으로 스티칭한다', () => {
    const base = makePattern(W, 140)
    const frames = [sliceRows(base, W, 0, 50), sliceRows(base, W, 30, 80), sliceRows(base, W, 60, 110)]
    const result = stitchFrames(frames)

    expect(result.width).toBe(W)
    expect(result.height).toBe(110)
    expect(result.offsets).toEqual([30, 30])
    expect(result.fixedTop).toBe(0)
    // 픽셀 단위로 원본 패턴의 [0, 110) 행과 완전히 일치해야 한다
    expect(Buffer.from(result.data).equals(Buffer.from(base.slice(0, 110 * W * 4)))).toBe(true)
  })

  it('고정 헤더가 있으면 첫 프레임 것만 남기고 콘텐츠를 이어붙인다', () => {
    const header = makePattern(W, 10, 7) // 모든 프레임 상단에 동일하게 등장
    const content = makePattern(W, 200, 99)
    const rowBytes = W * 4
    // 뷰포트 높이 60 = 헤더 10 + 콘텐츠 50, 25px씩 스크롤
    const frameAt = (start: number): StitchFrame =>
      concatRows(W, header, content.slice(start * rowBytes, (start + 50) * rowBytes))
    const frames = [frameAt(0), frameAt(25), frameAt(50)]

    const profiles = frames.map((f) => computeRowProfile(f))
    expect(detectFixedTop(profiles, 60)).toBe(10)

    const result = stitchFrames(frames)
    expect(result.fixedTop).toBe(10)
    expect(result.offsets).toEqual([25, 25])
    expect(result.height).toBe(110) // 60 + 25 + 25

    // 결과 = 헤더(10행) + 콘텐츠 [0, 100)행
    const expected = concatRows(W, header, content.slice(0, 100 * rowBytes))
    expect(Buffer.from(result.data).equals(Buffer.from(expected.data))).toBe(true)
  })

  it('동일 프레임이 이어지면 건너뛴다 (새 콘텐츠 없음)', () => {
    const base = makePattern(W, 60)
    const f = sliceRows(base, W, 0, 50)
    const result = stitchFrames([f, { ...f, data: f.data.slice() }])
    expect(result.height).toBe(50)
    expect(result.offsets).toEqual([0])
  })

  it('프레임 1장이면 그대로 반환한다', () => {
    const base = makePattern(W, 50)
    const f = sliceRows(base, W, 0, 50)
    const result = stitchFrames([f])
    expect(result.height).toBe(50)
    expect(result.offsets).toEqual([])
    expect(Buffer.from(result.data).equals(Buffer.from(f.data))).toBe(true)
  })

  it('프레임 크기가 다르면 에러를 던진다', () => {
    const base = makePattern(W, 100)
    const a = sliceRows(base, W, 0, 50)
    const b = sliceRows(base, W, 0, 40)
    expect(() => stitchFrames([a, b])).toThrow()
  })
})

describe('framesAlmostIdentical', () => {
  it('같은 프레임은 true', () => {
    const base = makePattern(W, 50)
    const a = sliceRows(base, W, 0, 50)
    const b = { ...a, data: a.data.slice() }
    expect(framesAlmostIdentical(a, b)).toBe(true)
  })

  it('스크롤된 프레임은 false', () => {
    const base = makePattern(W, 90)
    const a = sliceRows(base, W, 0, 50)
    const b = sliceRows(base, W, 30, 80)
    expect(framesAlmostIdentical(a, b)).toBe(false)
  })

  it('크기가 다르면 false', () => {
    const base = makePattern(W, 90)
    expect(framesAlmostIdentical(sliceRows(base, W, 0, 50), sliceRows(base, W, 0, 40))).toBe(false)
  })
})
