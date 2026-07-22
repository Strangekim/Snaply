/**
 * 새 문서 템플릿 — 비교/튜토리얼/타임라인. 소유자: Editor.
 * 골격(배경색 캔버스 + 가이드 프레임/라벨)만 만들고, 이미지는 Ctrl+V 붙여넣기로 채운다.
 */
import { createFrame, newId } from './objects'
import { resolveCssVar } from './palette'
import type { AnnoObject, ArrowObj, StepObj, TextObj } from './types'

export type TemplateKind = 'compare' | 'tutorial' | 'timeline'

export interface TemplateDoc {
  kind: TemplateKind
  fileName: string
  width: number
  height: number
  /** 배경색 토큰 변수명 */
  bgToken: string
  objects: AnnoObject[]
  stepCounter: number
}

const label = (x: number, y: number, text: string, fontSize = 28): TextObj => ({
  id: newId(),
  x,
  y,
  rotation: 0,
  color: 'black',
  type: 'text',
  text,
  fontSize
})

const step = (x: number, y: number, value: number): StepObj => ({
  id: newId(),
  x,
  y,
  rotation: 0,
  color: 'blue',
  type: 'step',
  value,
  radius: 22
})

const arrow = (x: number, y: number, dx: number): ArrowObj => ({
  id: newId(),
  x,
  y,
  rotation: 0,
  color: 'blue',
  type: 'arrow',
  points: [0, 0, dx, 0],
  strokeWidth: 5,
  headSize: 16
})

const PASTE_HINT = '이미지를 붙여넣어 주세요 (Ctrl+V)'

/** 템플릿 골격 생성 — 순수 로직 (DOM 없음) */
export function buildTemplate(kind: TemplateKind): TemplateDoc {
  switch (kind) {
    case 'compare': {
      const width = 1280
      const height = 780
      return {
        kind,
        fileName: '템플릿 - 비교',
        width,
        height,
        bgToken: '--grey-100',
        stepCounter: 0,
        objects: [
          label(56, 56, 'Before'),
          label(672, 56, 'After'),
          createFrame({ x: 56, y: 120, width: 560, height: 600 }, PASTE_HINT),
          createFrame({ x: 672, y: 120, width: 560, height: 600 }, PASTE_HINT)
        ]
      }
    }
    case 'tutorial': {
      const width = 920
      const height = 1160
      const objects: AnnoObject[] = []
      for (let i = 0; i < 3; i++) {
        const y = 64 + i * 368
        objects.push(step(96, y + 150, i + 1))
        objects.push(createFrame({ x: 160, y, width: 700, height: 300 }, PASTE_HINT))
      }
      return {
        kind,
        fileName: '템플릿 - 튜토리얼',
        width,
        height,
        bgToken: '--grey-100',
        stepCounter: 3,
        objects
      }
    }
    case 'timeline': {
      const width = 1400
      const height = 560
      const objects: AnnoObject[] = []
      for (let i = 0; i < 3; i++) {
        const x = 84 + i * 448
        objects.push(createFrame({ x, y: 100, width: 360, height: 360 }, PASTE_HINT))
        if (i < 2) objects.push(arrow(x + 372, 280, 60))
      }
      return {
        kind,
        fileName: '템플릿 - 타임라인',
        width,
        height,
        bgToken: '--grey-100',
        stepCounter: 0,
        objects
      }
    }
  }
}

/** 단색 배경 캔버스 dataURL 생성 (DOM 필요) */
export function makeSolidBackground(width: number, height: number, bgToken: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = resolveCssVar(bgToken) || '#f2f4f6'
    ctx.fillRect(0, 0, width, height)
  }
  return canvas.toDataURL('image/png')
}
