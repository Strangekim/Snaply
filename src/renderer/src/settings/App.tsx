import { useEffect, useState } from 'react'
import { useTheme } from '../common/useTheme'
import type { AppSettings } from '@shared/ipc'

export function App(): React.JSX.Element {
  useTheme()
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    void window.snaply.invoke('settings:get', undefined).then(setSettings)
  }, [])

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--text-h2)', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>설정</h1>
      <div
        style={{
          marginTop: 'var(--space-6)',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)',
          padding: 'var(--space-6)',
          color: 'var(--text-sub)'
        }}
      >
        {settings ? (
          <>
            <div>저장 경로: {settings.savePath}</div>
            <div style={{ marginTop: 'var(--space-2)' }}>캡처 단축키: {settings.hotkeys.allInOne}</div>
            <div style={{ marginTop: 'var(--space-2)' }}>설정 화면은 Phase 4에서 완성돼요</div>
          </>
        ) : (
          '불러오는 중...'
        )}
      </div>
    </div>
  )
}
