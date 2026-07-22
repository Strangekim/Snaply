import { describe, expect, it } from 'vitest'
import { glassBase, glassButton, glassCapsule, glassCard, overlayCss } from '@renderer/overlay/glass'

/** 오버레이 글래스 스타일이 디자인 토큰만 사용하는지(색상 하드코딩 금지 규칙) 검증한다 */

const HARDCODED_COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/

function colorValues(style: Record<string, unknown>): string[] {
  return Object.entries(style)
    .filter(([key]) => /color|background|border|shadow|outline/i.test(key))
    .map(([, value]) => String(value))
}

describe('overlay glass 스타일', () => {
  it.each([
    ['glassBase', glassBase],
    ['glassCapsule', glassCapsule],
    ['glassCard', glassCard],
    ['glassButton', glassButton]
  ])('%s 색상 관련 값에 하드코딩 색상이 없다', (_name, style) => {
    for (const value of colorValues(style as Record<string, unknown>)) {
      expect(value).not.toMatch(HARDCODED_COLOR)
    }
  })

  it('색상을 지정하는 속성은 토큰(var(--…)) 또는 transparent/none만 사용한다', () => {
    for (const style of [glassBase, glassCapsule, glassCard, glassButton]) {
      for (const value of colorValues(style as Record<string, unknown>)) {
        expect(value === 'transparent' || value === 'none' || value.includes('var(--')).toBe(true)
      }
    }
  })

  it('overlayCss 문자열에도 하드코딩 색상이 없다', () => {
    expect(overlayCss).not.toMatch(HARDCODED_COLOR)
  })

  it('캡슐/카드 형태는 각각의 radius 토큰을 쓴다', () => {
    expect(glassCapsule.borderRadius).toBe('var(--radius-capsule)')
    expect(glassCard.borderRadius).toBe('var(--radius-card)')
  })
})
