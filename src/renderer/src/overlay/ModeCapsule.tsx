import { glassButton, glassCapsule } from './glass'
import type { OverlayMode } from './types'

const SEGMENTS: Array<{ id: OverlayMode; label: string }> = [
  { id: 'region', label: '영역' },
  { id: 'window', label: '창' },
  { id: 'fullscreen', label: '전체 화면' }
]

interface ModeCapsuleProps {
  mode: OverlayMode
  onChange: (mode: OverlayMode) => void
  onCancel: () => void
}

/** 오버레이 상단 중앙의 캡처 모드 전환 캡슐 툴바 */
export function ModeCapsule({ mode, onChange, onCancel }: ModeCapsuleProps): React.JSX.Element {
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
            {seg.label}
          </button>
        )
      })}
      <div style={{ width: 1, alignSelf: 'stretch', margin: '6px var(--space-1)', background: 'var(--overlay-glass-border)' }} />
      <button
        type="button"
        className="ov-hover"
        style={{ ...glassButton, color: 'var(--overlay-text-sub)' }}
        onClick={onCancel}
      >
        ✕ 취소
      </button>
    </div>
  )
}
