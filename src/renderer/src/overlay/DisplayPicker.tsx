import { useState } from 'react'
import { useI18n } from '../common/i18n'
import { glassCard } from './glass'
import type { Session } from './types'

interface DisplayPickerProps {
  session: Session
  onPick: (displayId: number) => void
}

/** 전체 화면 캡처(멀티 모니터): 각 디스플레이 위에 이름 카드를 띄우고 클릭한 모니터를 캡처 */
export function DisplayPicker({ session, onPick }: DisplayPickerProps): React.JSX.Element {
  const { t } = useI18n()
  const [hoverId, setHoverId] = useState<number | null>(null)

  return (
    <>
      {session.displays.map((d, i) => {
        const hovered = hoverId === d.id
        return (
          <div
            key={d.id}
            style={{
              position: 'absolute',
              left: d.bounds.x - session.originX,
              top: d.bounds.y - session.originY,
              width: d.bounds.width,
              height: d.bounds.height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              outline: hovered ? '4px solid var(--primary)' : '4px solid transparent',
              outlineOffset: -4,
              transition: 'outline-color var(--transition-fast)',
              zIndex: 20
            }}
            onMouseEnter={() => setHoverId(d.id)}
            onMouseLeave={() => setHoverId((cur) => (cur === d.id ? null : cur))}
            onClick={() => onPick(d.id)}
          >
            <div
              style={{
                ...glassCard,
                padding: 'var(--space-6) var(--space-8)',
                textAlign: 'center',
                transform: hovered ? 'scale(1.04)' : 'scale(1)',
                transition: 'transform var(--transition-fast)',
                pointerEvents: 'none'
              }}
            >
              <div style={{ fontSize: 'var(--text-h2)', fontWeight: 700 }}>
                {d.label || `${t('디스플레이')} ${i + 1}`}
                {d.isPrimary ? ` · ${t('주 모니터')}` : ''}
              </div>
              <div
                style={{
                  marginTop: 'var(--space-2)',
                  fontSize: 'var(--text-body-size)',
                  color: 'var(--overlay-text-sub)',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {d.bounds.width} × {d.bounds.height}
                {d.scaleFactor !== 1 ? ` · ${t('배율 {n}%', { n: Math.round(d.scaleFactor * 100) })}` : ''}
              </div>
              <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-caption)', color: 'var(--overlay-text-sub)' }}>
                {t('클릭하면 이 화면을 캡처해요')}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
