import { describe, expect, it } from 'vitest'
import { formatFilename } from '@shared/filename'

describe('formatFilename', () => {
  const date = new Date(2026, 6, 22, 9, 5, 3)

  it('기본 패턴을 채운다', () => {
    expect(formatFilename('snaply-{yyyy}{MM}{dd}-{HH}{mm}{ss}', date)).toBe('snaply-20260722-090503')
  })

  it('빈 패턴이면 기본 패턴을 쓴다', () => {
    expect(formatFilename('', date)).toBe('snaply-20260722-090503')
  })

  it('일부 토큰만 있어도 동작한다', () => {
    expect(formatFilename('cap_{yyyy}-{MM}', date)).toBe('cap_2026-07')
  })
})
