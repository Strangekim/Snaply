/**
 * 스크롤 캡처 스티칭 — 순수 로직 모듈.
 * electron import 금지 (tests/unit/stitch.test.ts에서 node 환경으로 단위 테스트).
 *
 * 알고리즘 개요:
 * 1) 각 프레임을 "행 프로파일"로 축약한다: 행마다 B개 버킷(가로 구간)의 그레이스케일 평균.
 *    - 좌우 10% 마진은 스크롤바/사이드 장식의 영향을 줄이기 위해 제외한다.
 *    - 그레이 변환은 (c0+c1+c2)/3 — RGBA/BGRA 채널 순서와 무관하다.
 * 2) 고정 헤더 감지: 모든 프레임에서 동일한 상단 행들(툴바·고정 헤더)은 매칭에서 제외하고
 *    출력에는 첫 프레임의 것만 사용한다.
 * 3) 인접 프레임 쌍마다 "다음 프레임 = 이전 프레임을 d픽셀 위로 스크롤한 것" 가정 하에
 *    행 단위 SAD(절대차 합)가 최소가 되는 오프셋 d를 전수 탐색한다.
 *    (비교는 다음 프레임 상단의 최대 maxCompareRows행 스트립만 사용해 비용을 줄인다)
 * 4) d만큼 새로 드러난 "다음 프레임의 하단 d행"만 캔버스에 이어붙인다.
 *    d가 minOffset보다 작으면 새 콘텐츠 없음(하단 도달)으로 간주하고 건너뛴다.
 */

export interface StitchFrame {
  /** 4바이트/픽셀 픽셀 버퍼 (RGBA 또는 BGRA — 채널 순서 무관) */
  data: Uint8Array
  width: number
  height: number
}

export interface StitchOptions {
  /** 좌우 제외 마진 비율 (기본 0.1 = 각 10%) */
  sideMarginRatio?: number
  /** 행 프로파일 버킷 수 (기본 16) */
  buckets?: number
  /** 고정 상단(헤더) 판정 허용 오차 — 행 프로파일 평균 절대차 (기본 2) */
  fixedTopTolerance?: number
  /** "실질적으로 같은 프레임" 판정 임계 — 전체 행 평균 절대차 (기본 1) */
  sameThreshold?: number
  /** 이보다 작은 오프셋은 "새 콘텐츠 없음"으로 간주 (기본 4px) */
  minOffset?: number
  /** 오프셋 탐색 시 반드시 겹쳐야 하는 최소 비율 (기본 0.2 = 20%) */
  minOverlapRatio?: number
  /** 오프셋 탐색 시 비교에 사용할 다음 프레임 상단 스트립 최대 행 수 (기본 160) */
  maxCompareRows?: number
}

const DEFAULTS: Required<StitchOptions> = {
  sideMarginRatio: 0.1,
  buckets: 16,
  fixedTopTolerance: 2,
  sameThreshold: 1,
  minOffset: 4,
  minOverlapRatio: 0.2,
  maxCompareRows: 160
}

export interface StitchResult {
  /** 이어붙인 최종 픽셀 버퍼 (입력과 같은 채널 순서) */
  data: Uint8Array
  width: number
  height: number
  /** 각 인접 쌍에서 감지된 스크롤 오프셋 (0 = 새 콘텐츠 없음 → 해당 프레임 건너뜀) */
  offsets: number[]
  /** 감지된 상단 고정 영역 높이 (px) */
  fixedTop: number
}

function mergeOptions(options?: StitchOptions): Required<StitchOptions> {
  return { ...DEFAULTS, ...(options ?? {}) }
}

/** 프레임 → 행 프로파일 (height × buckets, 각 값은 해당 가로 구간의 그레이 평균 0~255) */
export function computeRowProfile(frame: StitchFrame, options?: StitchOptions): Float32Array {
  const o = mergeOptions(options)
  const { data, width, height } = frame
  const B = o.buckets
  const x0 = Math.floor(width * o.sideMarginRatio)
  const x1 = Math.max(x0 + 1, width - x0)
  const span = x1 - x0
  const prof = new Float32Array(height * B)
  const counts = new Float32Array(B)

  for (let y = 0; y < height; y++) {
    counts.fill(0)
    const rowBase = y * width * 4
    const profBase = y * B
    for (let x = x0; x < x1; x++) {
      const i = rowBase + x * 4
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3
      const b = Math.min(B - 1, Math.floor(((x - x0) * B) / span))
      prof[profBase + b] += gray
      counts[b] += 1
    }
    for (let b = 0; b < B; b++) {
      if (counts[b] > 0) prof[profBase + b] /= counts[b]
    }
  }
  return prof
}

/** 두 프로파일의 특정 행끼리 평균 절대차 (0~255 스케일) */
function rowDiff(a: Float32Array, b: Float32Array, rowA: number, rowB: number, buckets: number): number {
  let sum = 0
  const ia = rowA * buckets
  const ib = rowB * buckets
  for (let k = 0; k < buckets; k++) sum += Math.abs(a[ia + k] - b[ib + k])
  return sum / buckets
}

/** 모든 프레임에서 동일하게 유지되는 상단 행 수 감지 (고정 헤더/툴바 대응). 최대 높이의 절반까지만 */
export function detectFixedTop(profiles: Float32Array[], height: number, options?: StitchOptions): number {
  const o = mergeOptions(options)
  if (profiles.length < 2) return 0
  const cap = Math.floor(height / 2)
  for (let y = 0; y < cap; y++) {
    for (let f = 1; f < profiles.length; f++) {
      if (rowDiff(profiles[0], profiles[f], y, y, o.buckets) > o.fixedTopTolerance) return y
    }
  }
  return cap
}

/**
 * 인접 프레임 쌍의 스크롤 오프셋 탐색.
 * 가정: next[y] ≈ prev[y + d] (y ∈ [fixedTop, height - d)).
 * 반환 offset이 0에 가까우면 새 콘텐츠 없음.
 */
export function findOverlapOffset(
  prevProfile: Float32Array,
  nextProfile: Float32Array,
  height: number,
  fixedTop: number,
  options?: StitchOptions
): { offset: number; score: number } {
  const o = mergeOptions(options)
  const B = o.buckets
  const scrollable = height - fixedTop
  const minOverlap = Math.max(8, Math.round(scrollable * o.minOverlapRatio))
  const maxD = Math.max(0, scrollable - minOverlap)

  let best = 0
  let bestScore = Infinity
  for (let d = 0; d <= maxD; d++) {
    const yEnd = Math.min(height - d, fixedTop + o.maxCompareRows)
    let sum = 0
    let n = 0
    for (let y = fixedTop; y < yEnd; y++) {
      sum += rowDiff(prevProfile, nextProfile, y + d, y, B)
      n++
    }
    if (n === 0) continue
    const score = sum / n
    if (score < bestScore) {
      bestScore = score
      best = d
    }
  }
  return { offset: best, score: bestScore }
}

/** 두 프레임이 실질적으로 동일한지 (스크롤이 더 이상 진행되지 않음 = 하단 도달 판정용) */
export function framesAlmostIdentical(a: StitchFrame, b: StitchFrame, options?: StitchOptions): boolean {
  if (a.width !== b.width || a.height !== b.height) return false
  const o = mergeOptions(options)
  const pa = computeRowProfile(a, o)
  const pb = computeRowProfile(b, o)
  let sum = 0
  for (let y = 0; y < a.height; y++) sum += rowDiff(pa, pb, y, y, o.buckets)
  return sum / a.height < o.sameThreshold
}

/** 프레임 배열을 세로로 이어붙인다. 모든 프레임은 같은 크기여야 한다. */
export function stitchFrames(frames: StitchFrame[], options?: StitchOptions): StitchResult {
  if (frames.length === 0) throw new Error('스티칭할 프레임이 없어요.')
  const o = mergeOptions(options)
  const { width, height } = frames[0]
  for (const f of frames) {
    if (f.width !== width || f.height !== height) throw new Error('모든 프레임의 크기가 같아야 해요.')
    if (f.data.length !== width * height * 4) throw new Error('픽셀 버퍼 크기가 프레임 크기와 맞지 않아요.')
  }

  const profiles = frames.map((f) => computeRowProfile(f, o))
  const fixedTop = detectFixedTop(profiles, height, o)
  const rowBytes = width * 4

  const parts: Uint8Array[] = [frames[0].data]
  const offsets: number[] = []
  let totalRows = height

  for (let i = 1; i < frames.length; i++) {
    const { offset } = findOverlapOffset(profiles[i - 1], profiles[i], height, fixedTop, o)
    if (offset < o.minOffset) {
      // 새 콘텐츠 없음 → 프레임 건너뜀 (종료 신호)
      offsets.push(0)
      continue
    }
    offsets.push(offset)
    parts.push(frames[i].data.subarray((height - offset) * rowBytes))
    totalRows += offset
  }

  const out = new Uint8Array(totalRows * rowBytes)
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return { data: out, width, height: totalRows, offsets, fixedTop }
}
