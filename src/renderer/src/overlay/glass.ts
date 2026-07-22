import type { CSSProperties } from 'react'

/** 다크 글래스 공통 스타일 — 반드시 tokens.css의 오버레이 토큰만 사용 (색상 하드코딩 금지) */
export const glassBase: CSSProperties = {
  background: 'var(--overlay-glass)',
  border: '1px solid var(--overlay-glass-border)',
  color: 'var(--overlay-text)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: 'var(--shadow-float)'
}

/** 캡슐 형태 (툴바, 배지) */
export const glassCapsule: CSSProperties = {
  ...glassBase,
  borderRadius: 'var(--radius-capsule)'
}

/** 카드 형태 (패널, 돋보기) */
export const glassCard: CSSProperties = {
  ...glassBase,
  borderRadius: 'var(--radius-card)'
}

/** 글래스 위 버튼 공통 */
export const glassButton: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--overlay-text)',
  font: 'inherit',
  fontSize: 'var(--text-body-size)',
  cursor: 'pointer',
  borderRadius: 'var(--radius-capsule)',
  padding: '8px 16px',
  whiteSpace: 'nowrap'
}

/** 오버레이 전용 hover 스타일 — 새 색상을 만들지 않도록 brightness/토큰만 사용 */
export const overlayCss = `
  .ov-hover { transition: filter var(--transition-fast), transform var(--transition-fast); }
  .ov-hover:hover { filter: brightness(1.3); }
  .ov-hover:active { filter: brightness(1.15); transform: scale(0.97); }
  .ov-card { transition: outline-color var(--transition-fast), transform var(--transition-fast); outline: 2px solid transparent; outline-offset: -2px; }
  .ov-card:hover { outline-color: var(--primary); transform: translateY(-2px); }
`
