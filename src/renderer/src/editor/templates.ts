/**
 * 새 문서 템플릿 — 비교/튜토리얼/타임라인/그리드/캡션. 소유자: Editor.
 * 골격(배경색 캔버스 + 가이드 프레임/라벨)을 만들고, seed(현재 편집 중이던 이미지)가
 * 있으면 첫 프레임에 contain 맞춤으로 넣는다. 나머지는 Ctrl+V 붙여넣기로 채운다.
 */
import { createFrame, createImage, newId } from './objects'
import { resolveCssVar } from './palette'
import type { AnnoObject, ArrowObj, FrameObj, StepObj, TextObj } from './types'

export type TemplateKind = 'compare' | 'tutorial' | 'timeline' | 'grid4' | 'caption'

/** 번역 함수 (기본 항등 — 순수 테스트에서 그대로 사용) */
export type Translate = (ko: string) => string

/** 템플릿에 넣을 기존 이미지 (현재 편집 중이던 문서) */
export interface TemplateSeed {
  src: string
  width: number
  height: number
}

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

/** seed 이미지를 프레임에 contain 맞춤으로 넣는다 */
function seedIntoFrame(seed: TemplateSeed, frame: FrameObj): AnnoObject {
  const scale = Math.min(frame.width / seed.width, frame.height / seed.height)
  const w = seed.width * scale
  const h = seed.height * scale
  return createImage(
    { x: frame.x + (frame.width - w) / 2, y: frame.y + (frame.height - h) / 2 },
    w,
    h,
    seed.src
  )
}

/** 템플릿 골격 생성 — 순수 로직 (DOM 없음). t로 라벨/파일명을 번역한다 */
export function buildTemplate(
  kind: TemplateKind,
  t: Translate = (s) => s,
  seed?: TemplateSeed | null
): TemplateDoc {
  const hint = t('이미지를 붙여넣어 주세요 (Ctrl+V)')
  const frames: FrameObj[] = []
  const frame = (x: number, y: number, width: number, height: number): FrameObj => {
    const f = createFrame({ x, y, width, height }, hint)
    frames.push(f)
    return f
  }

  let docBase: Omit<TemplateDoc, 'objects'> & { objects: AnnoObject[] }
  switch (kind) {
    case 'compare': {
      docBase = {
        kind,
        fileName: t('템플릿 - 비교'),
        width: 1280,
        height: 780,
        bgToken: '--grey-100',
        stepCounter: 0,
        objects: [
          label(56, 56, t('전')),
          label(672, 56, t('후')),
          frame(56, 120, 560, 600),
          frame(672, 120, 560, 600)
        ]
      }
      break
    }
    case 'tutorial': {
      const objects: AnnoObject[] = []
      for (let i = 0; i < 3; i++) {
        const y = 64 + i * 368
        objects.push(step(96, y + 150, i + 1))
        objects.push(frame(160, y, 700, 300))
      }
      docBase = {
        kind,
        fileName: t('템플릿 - 튜토리얼'),
        width: 920,
        height: 1160,
        bgToken: '--grey-100',
        stepCounter: 3,
        objects
      }
      break
    }
    case 'timeline': {
      const objects: AnnoObject[] = []
      for (let i = 0; i < 3; i++) {
        const x = 84 + i * 448
        objects.push(frame(x, 100, 360, 360))
        if (i < 2) objects.push(arrow(x + 372, 280, 60))
      }
      docBase = {
        kind,
        fileName: t('템플릿 - 타임라인'),
        width: 1400,
        height: 560,
        bgToken: '--grey-100',
        stepCounter: 0,
        objects
      }
      break
    }
    case 'grid4': {
      // 2×2 그리드 — 스크린샷 모아보기
      const objects: AnnoObject[] = []
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          objects.push(frame(56 + col * 600, 56 + row * 430, 560, 400))
        }
      }
      docBase = {
        kind,
        fileName: t('템플릿 - 그리드'),
        width: 1272,
        height: 942,
        bgToken: '--grey-100',
        stepCounter: 0,
        objects
      }
      break
    }
    case 'caption': {
      // 큰 이미지 1장 + 제목/설명 캡션
      docBase = {
        kind,
        fileName: t('템플릿 - 캡션'),
        width: 1080,
        height: 860,
        bgToken: '--grey-50',
        stepCounter: 0,
        objects: [
          frame(60, 60, 960, 580),
          label(60, 676, t('제목을 입력해 주세요'), 34),
          label(60, 736, t('설명을 입력해 주세요'), 22)
        ]
      }
      break
    }
  }

  // 편집 중이던 이미지를 첫 프레임에 자동 삽입
  if (seed && frames.length > 0) {
    docBase.objects = [...docBase.objects, seedIntoFrame(seed, frames[0])]
  }
  return docBase
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
