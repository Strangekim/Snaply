import { useEffect, useState } from 'react'
import { glassCard } from './glass'
import type { WindowSource } from './types'

// TODO(platform-verify): 마우스 아래 네이티브 창 경계를 실시간 hover 감지(스냅 하이라이트)하려면
// OS별 창 열거 API(Windows: EnumWindows/DwmGetWindowAttribute, macOS: CGWindowListCopyWindowInfo)가 필요하다.
// Phase 1에서는 desktopCapturer 기반 그리드 선택 UI로 대체한다.

interface WindowPickerProps {
  onPick: (win: WindowSource) => void
}

/** 창 캡처: 열려 있는 창 목록을 다크 글래스 그리드 카드로 표시 */
export function WindowPicker({ onPick }: WindowPickerProps): React.JSX.Element {
  const [windows, setWindows] = useState<WindowSource[] | null>(null)

  useEffect(() => {
    let alive = true
    void window.snaply.invoke('capture:listWindows', undefined).then((list) => {
      if (alive) setWindows(list)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 30
      }}
    >
      <div
        style={{
          ...glassCard,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          padding: 'var(--space-6)',
          maxWidth: 'min(1080px, 82vw)',
          maxHeight: '74vh'
        }}
      >
        <div style={{ fontSize: 'var(--text-section)', fontWeight: 600 }}>캡처할 창을 선택해 주세요</div>
        {windows === null && (
          <div style={{ color: 'var(--overlay-text-sub)', padding: 'var(--space-8)', textAlign: 'center' }}>
            창 목록을 불러오고 있어요…
          </div>
        )}
        {windows !== null && windows.length === 0 && (
          <div style={{ color: 'var(--overlay-text-sub)', padding: 'var(--space-8)', textAlign: 'center' }}>
            캡처할 수 있는 창이 없어요
          </div>
        )}
        {windows !== null && windows.length > 0 && (
          <div
            style={{
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 'var(--space-3)',
              paddingRight: 'var(--space-1)'
            }}
          >
            {windows.map((w) => (
              <button
                key={w.sourceId}
                type="button"
                className="ov-card"
                style={{
                  ...glassCard,
                  boxShadow: 'none',
                  font: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2)'
                }}
                onClick={() => onPick(w)}
              >
                <div
                  style={{
                    aspectRatio: '16 / 10',
                    width: '100%',
                    borderRadius: 'var(--radius-button)',
                    background: 'var(--overlay-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}
                >
                  <img
                    src={w.thumbnailDataUrl}
                    draggable={false}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ padding: '0 var(--space-1) var(--space-1)' }}>
                  <div
                    style={{
                      fontSize: 'var(--text-caption)',
                      fontWeight: 600,
                      color: 'var(--overlay-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={w.title}
                  >
                    {w.title}
                  </div>
                  {w.appName && (
                    <div
                      style={{
                        fontSize: 'var(--text-caption)',
                        color: 'var(--overlay-text-sub)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {w.appName}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
