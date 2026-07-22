import { useEffect, useState } from 'react'
import { useTheme } from '../common/useTheme'
import type { CaptureResult } from '@shared/ipc'

export function App(): React.JSX.Element {
  useTheme()
  const [version, setVersion] = useState('')
  const [lastCapture, setLastCapture] = useState<CaptureResult | null>(null)

  useEffect(() => {
    void window.snaply.invoke('app:getVersion', undefined).then(setVersion)
    return window.snaply.on('event:captureCompleted', setLastCapture)
  }, [])

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--text-h1)', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
        Snaply
      </h1>
      <p style={{ color: 'var(--text-sub)', marginTop: 'var(--space-2)' }}>
        보관함이 여기에 들어와요 · v{version}
      </p>
      <div
        style={{
          marginTop: 'var(--space-6)',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)',
          padding: 'var(--space-6)'
        }}
      >
        {lastCapture ? (
          <>
            <div style={{ fontSize: 'var(--text-section)', fontWeight: 600, color: 'var(--text-title)' }}>
              방금 캡처했어요
            </div>
            <div style={{ color: 'var(--text-sub)', marginTop: 'var(--space-2)', fontSize: 'var(--text-caption)' }}>
              {lastCapture.filePath} ({lastCapture.width}×{lastCapture.height})
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-sub)' }}>아직 캡처가 없어요. 트레이 메뉴에서 캡처해 보세요.</div>
        )}
      </div>
      <button
        style={{
          marginTop: 'var(--space-6)',
          width: '100%',
          height: 56,
          border: 'none',
          borderRadius: 'var(--radius-button)',
          background: 'var(--primary)',
          color: 'var(--white)',
          fontSize: 'var(--text-section)',
          fontWeight: 600,
          fontFamily: 'var(--font)',
          cursor: 'pointer'
        }}
        onClick={() => void window.snaply.invoke('capture:start', { mode: 'fullscreen' })}
      >
        전체 화면 캡처하기
      </button>
    </div>
  )
}
