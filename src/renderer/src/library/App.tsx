import { useEffect, useState } from 'react'
import { Button, Card, ToastProvider, useToast } from '@ds/index'
import { useTheme } from '../common/useTheme'
import type { CaptureResult } from '@shared/ipc'

function Home(): React.JSX.Element {
  const { toast } = useToast()
  const [version, setVersion] = useState('')
  const [lastCapture, setLastCapture] = useState<CaptureResult | null>(null)

  useEffect(() => {
    void window.snaply.invoke('app:getVersion', undefined).then(setVersion)
    return window.snaply.on('event:captureCompleted', (result) => {
      setLastCapture(result)
      toast('캡처했어요', { type: 'success' })
    })
  }, [toast])

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--text-h1)', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
        Snaply
      </h1>
      <p style={{ color: 'var(--text-sub)', marginTop: 'var(--space-2)' }}>
        보관함이 여기에 들어와요 · v{version}
      </p>
      <Card style={{ marginTop: 'var(--space-6)' }}>
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
          <div style={{ color: 'var(--text-sub)' }}>아직 캡처가 없어요. 아래 버튼이나 트레이 메뉴에서 캡처해 보세요.</div>
        )}
      </Card>
      <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => void window.snaply.invoke('capture:start', { mode: 'all-in-one' })}
        >
          캡처하기
        </Button>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => void window.snaply.invoke('capture:start', { mode: 'window' })}
          >
            창 캡처
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => void window.snaply.invoke('capture:start', { mode: 'fullscreen' })}
          >
            전체 화면
          </Button>
        </div>
      </div>
    </div>
  )
}

export function App(): React.JSX.Element {
  useTheme()
  return (
    <ToastProvider>
      <Home />
    </ToastProvider>
  )
}
