/**
 * QA(Phase 3) — 템플릿/스탬프 순수 모듈 통합 위험 지점 테스트.
 * - buildTemplate: TemplateSheet가 새 문서를 여는 유일한 경로 — 골격 구조가 깨지면 빈 캔버스가 열린다.
 * - STAMPS: StampPicker/AnnotationNode가 같은 정의를 공유 — kind 누락·중복 시 렌더가 조용히 실패한다.
 */
import { describe, expect, it } from 'vitest'
import { buildTemplate, type TemplateKind } from '../../src/renderer/src/editor/templates'
import { STAMPS, STAMP_VIEWBOX } from '../../src/renderer/src/editor/stamps'

const KINDS: TemplateKind[] = ['compare', 'tutorial', 'timeline']

describe('buildTemplate', () => {
  it('세 템플릿 모두 유효한 크기와 배경 토큰을 가진다', () => {
    for (const kind of KINDS) {
      const doc = buildTemplate(kind)
      expect(doc.kind).toBe(kind)
      expect(doc.width).toBeGreaterThan(0)
      expect(doc.height).toBeGreaterThan(0)
      expect(doc.bgToken.startsWith('--')).toBe(true)
      expect(doc.fileName.length).toBeGreaterThan(0)
    }
  })

  it('비교: Before/After 라벨 2개 + 프레임 2개', () => {
    const doc = buildTemplate('compare')
    expect(doc.objects.filter((o) => o.type === 'frame')).toHaveLength(2)
    const texts = doc.objects.filter((o) => o.type === 'text')
    expect(texts.map((t) => (t.type === 'text' ? t.text : ''))).toEqual(['Before', 'After'])
  })

  it('튜토리얼: 스텝 3개(1·2·3) + 프레임 3개, stepCounter=3', () => {
    const doc = buildTemplate('tutorial')
    expect(doc.objects.filter((o) => o.type === 'frame')).toHaveLength(3)
    const steps = doc.objects.filter((o) => o.type === 'step')
    expect(steps.map((s) => (s.type === 'step' ? s.value : 0))).toEqual([1, 2, 3])
    // 이후 스텝 도구가 4부터 이어가도록 카운터가 맞아야 한다
    expect(doc.stepCounter).toBe(3)
  })

  it('타임라인: 프레임 3개를 화살표 2개가 잇는다', () => {
    const doc = buildTemplate('timeline')
    expect(doc.objects.filter((o) => o.type === 'frame')).toHaveLength(3)
    expect(doc.objects.filter((o) => o.type === 'arrow')).toHaveLength(2)
  })

  it('모든 객체가 문서 경계 안에 있고 id가 서로 다르다', () => {
    for (const kind of KINDS) {
      const doc = buildTemplate(kind)
      const ids = doc.objects.map((o) => o.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const obj of doc.objects) {
        expect(obj.x).toBeGreaterThanOrEqual(0)
        expect(obj.y).toBeGreaterThanOrEqual(0)
        expect(obj.x).toBeLessThanOrEqual(doc.width)
        expect(obj.y).toBeLessThanOrEqual(doc.height)
      }
    }
  })

  it('호출할 때마다 새 id를 발급한다 (문서 간 id 충돌 방지)', () => {
    const a = buildTemplate('compare').objects.map((o) => o.id)
    const b = buildTemplate('compare').objects.map((o) => o.id)
    expect(a.some((id) => b.includes(id))).toBe(false)
  })
})

describe('STAMPS', () => {
  it('명세대로 12종 이상이고 kind가 중복되지 않는다', () => {
    expect(STAMPS.length).toBeGreaterThanOrEqual(12)
    const kinds = STAMPS.map((s) => s.kind)
    expect(new Set(kinds).size).toBe(kinds.length)
  })

  it('모든 스탬프에 라벨과 도형이 있다', () => {
    for (const stamp of STAMPS) {
      expect(stamp.label.length).toBeGreaterThan(0)
      expect(stamp.elements.length).toBeGreaterThan(0)
    }
  })

  it('circle 도형은 뷰박스(24) 안에 들어온다', () => {
    for (const stamp of STAMPS) {
      for (const el of stamp.elements) {
        if (el.kind === 'circle') {
          expect(el.cx - el.r).toBeGreaterThanOrEqual(0)
          expect(el.cx + el.r).toBeLessThanOrEqual(STAMP_VIEWBOX)
          expect(el.cy - el.r).toBeGreaterThanOrEqual(0)
          expect(el.cy + el.r).toBeLessThanOrEqual(STAMP_VIEWBOX)
        }
      }
    }
  })

  it('색상 지정은 토큰 변수(--*) 또는 리터럴만 사용한다', () => {
    for (const stamp of STAMPS) {
      for (const el of stamp.elements) {
        const colors = [
          'fill' in el ? el.fill : undefined,
          'stroke' in el ? el.stroke : undefined
        ].filter((c): c is string => typeof c === 'string')
        for (const c of colors) {
          expect(c.startsWith('--') || c.startsWith('#')).toBe(true)
        }
      }
    }
  })
})
