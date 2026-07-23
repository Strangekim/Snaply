import { useState } from 'react'
import { useI18n } from '../common/i18n'
import { glassButton, glassCapsule } from './glass'
import type { OverlayMode } from './types'

const SEGMENTS: Array<{ id: OverlayMode; label: string }> = [
  { id: 'region', label: '영역' },
  { id: 'window', label: '창' },
  { id: 'fullscreen', label: '전체 화면' },
  { id: 'scrolling', label: '스크롤' }
]

/** 지연 캡처 선택지 (초) */
const DELAY_SECONDS = [3, 5, 10]

interface ModeCapsuleProps {
  mode: OverlayMode
  onChange: (mode: OverlayMode) => void
  onCancel: () => void
  /** 지연 캡처 선택: 현재 모드로 delayMs 재시작 */
  onDelaySelect: (seconds: number) => void
}

/** 오버레이 상단 중앙의 캡처 모드 전환 캡슐 툴바 (+ 지연 캡처 타이머) */
export function ModeCapsule({ mode, onChange, onCancel, onDelaySelect }: ModeCapsuleProps): React.JSX.Element {
  const { t } = useI18n()
  const [delayOpen, setDelayOpen] = useState(false)

  return (
    <div
      style={{
        ...glassCapsule,
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: 6,
        zIndex: 50
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {SEGMENTS.map((seg) => {
        const active = seg.id === mode
        return (
          <button
            key={seg.id}
            type="button"
            className={active ? undefined : 'ov-hover'}
            style={{
              ...glassButton,
              background: active ? 'var(--primary)' : 'transparent',
              color: active ? 'var(--white)' : 'var(--overlay-text-sub)',
              fontWeight: active ? 600 : 500
            }}
            onClick={() => onChange(seg.id)}
          >
            {t(seg.label)}
          </button>
        )
      })}
      <div style={{ width: 1, alignSelf: 'stretch', margin: '6px var(--space-1)', background: 'var(--overlay-glass-border)' }} />

      {/* 지연 캡처 타이머: 클릭 → 3/5/10초 팝오버 */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="ov-hover"
          title={t('지연 캡처')}
          style={{
            ...glassButton,
            padding: '8px 12px',
            color: delayOpen ? 'var(--overlay-text)' : 'var(--overlay-text-sub)'
          }}
          onClick={() => setDelayOpen((v) => !v)}
        >
          ⏱
        </button>
        {delayOpen && (
          <div
            style={{
              ...glassCapsule,
              position: 'absolute',
              top: 'calc(100% + 12px)',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: 6,
              zIndex: 55
            }}
          >
            {DELAY_SECONDS.map((s) => (
              <button
                key={s}
                type="button"
                className="ov-hover"
                style={{ ...glassButton, padding: '8px 14px', color: 'var(--overlay-text-sub)' }}
                onClick={() => {
                  setDelayOpen(false)
                  onDelaySelect(s)
                }}
              >
                {t('{n}초', { n: s })}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 1, alignSelf: 'stretch', margin: '6px var(--space-1)', background: 'var(--overlay-glass-border)' }} />
      <button
        type="button"
        className="ov-hover"
        style={{ ...glassButton, color: 'var(--overlay-text-sub)' }}
        onClick={onCancel}
      >
        {t('✕ 취소')}
      </button>
    </div>
  )
}
