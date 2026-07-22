/**
 * 자체 제작 SVG 스탬프 세트 — 24×24 뷰박스 기준 도형 정의. 소유자: Editor.
 * 같은 정의를 SVG 미리보기(피커)와 Konva 렌더(캔버스)가 공유한다.
 * 색상은 tokens.css 변수명('--xxx') 또는 리터럴('#fff')로 지정한다.
 */
import type { StampKind } from './types'
import { resolveCssVar } from './palette'

export const STAMP_VIEWBOX = 24

export type StampElement =
  | { kind: 'path'; d: string; fill?: string; stroke?: string; strokeWidth?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; strokeWidth?: number }
  | { kind: 'text'; text: string; cx: number; cy: number; size: number; fill: string }

export interface StampDef {
  kind: StampKind
  label: string
  elements: StampElement[]
}

/** 색상 지정('--토큰' | 리터럴) → Konva용 실제 색상 값 */
export function stampColor(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value.startsWith('--') ? resolveCssVar(value) : value
}

/** 색상 지정 → SVG(DOM)용 값. CSS 변수는 var()로 감싼다 */
export function stampSvgColor(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value.startsWith('--') ? `var(${value})` : value
}

const face = (kind: StampKind, label: string, mouth: string): StampDef => ({
  kind,
  label,
  elements: [
    { kind: 'circle', cx: 12, cy: 12, r: 11, fill: '--yellow-500' },
    { kind: 'circle', cx: 8, cy: 9.5, r: 1.5, fill: '--grey-900' },
    { kind: 'circle', cx: 16, cy: 9.5, r: 1.5, fill: '--grey-900' },
    { kind: 'path', d: mouth, stroke: '--grey-900', strokeWidth: 1.8 }
  ]
})

const badge = (n: 1 | 2 | 3): StampDef => ({
  kind: `badge-${n}` as StampKind,
  label: `숫자 ${n}`,
  elements: [
    { kind: 'circle', cx: 12, cy: 12, r: 11, fill: '--blue-500' },
    { kind: 'text', text: String(n), cx: 12, cy: 12, size: 14, fill: '--white' }
  ]
})

export const STAMPS: StampDef[] = [
  {
    kind: 'check',
    label: '체크',
    elements: [
      { kind: 'circle', cx: 12, cy: 12, r: 11, fill: '--green-500' },
      { kind: 'path', d: 'M6.5 12.5l3.6 3.6 7.4-8.2', stroke: '--white', strokeWidth: 2.6 }
    ]
  },
  {
    kind: 'cross',
    label: '엑스',
    elements: [
      { kind: 'circle', cx: 12, cy: 12, r: 11, fill: '--red-500' },
      { kind: 'path', d: 'M8 8l8 8M16 8l-8 8', stroke: '--white', strokeWidth: 2.6 }
    ]
  },
  {
    kind: 'cursor',
    label: '커서',
    elements: [
      {
        kind: 'path',
        d: 'M6.5 2.5L19 12l-5.6 1.1 3 6.2-3 1.4-3-6.3-3.9 3.6z',
        fill: '--grey-900',
        stroke: '--white',
        strokeWidth: 1.4
      }
    ]
  },
  {
    kind: 'question',
    label: '물음표',
    elements: [
      { kind: 'circle', cx: 12, cy: 12, r: 11, fill: '--blue-500' },
      { kind: 'text', text: '?', cx: 12, cy: 12, size: 14, fill: '--white' }
    ]
  },
  {
    kind: 'exclamation',
    label: '느낌표',
    elements: [
      { kind: 'path', d: 'M12 2.2L22.5 20.5h-21z', fill: '--yellow-500' },
      { kind: 'path', d: 'M12 9v5.5', stroke: '--grey-900', strokeWidth: 2.2 },
      { kind: 'circle', cx: 12, cy: 17.6, r: 1.3, fill: '--grey-900' }
    ]
  },
  {
    kind: 'star',
    label: '별',
    elements: [
      {
        kind: 'path',
        d: 'M12 2l2.65 6.36 6.86.55-5.23 4.48 1.6 6.7L12 16.5l-5.88 3.59 1.6-6.7-5.23-4.48 6.86-.55z',
        fill: '--yellow-500'
      }
    ]
  },
  {
    kind: 'heart',
    label: '하트',
    elements: [
      {
        kind: 'path',
        d: 'M12 20.5C6 15.5 3.5 12.5 3.5 9.2c0-2.6 2.1-4.4 4.5-4.4 1.7 0 3.2.9 4 2.3.8-1.4 2.3-2.3 4-2.3 2.4 0 4.5 1.8 4.5 4.4 0 3.3-2.5 6.3-8.5 11.3z',
        fill: '--red-500'
      }
    ]
  },
  badge(1),
  badge(2),
  badge(3),
  face('face-smile', '웃는 얼굴', 'M8 14.5c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4'),
  face('face-neutral', '무표정', 'M8 15.5h8'),
  face('face-frown', '슬픈 얼굴', 'M8 16.8c1-1.6 2.4-2.4 4-2.4s3 .8 4 2.4')
]

export function stampDef(kind: StampKind): StampDef {
  return STAMPS.find((s) => s.kind === kind) ?? STAMPS[0]
}
