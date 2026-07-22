import { useEffect, useState } from 'react'
import { useTheme } from '../common/useTheme'

export function App(): React.JSX.Element {
  useTheme()
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    return window.snaply.on('event:openInEditor', ({ filePath }) => {
      void window.snaply.invoke('file:readDataUrl', filePath).then(setImageUrl)
    })
  }, [])

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-6)'
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)'
          }}
        />
      ) : (
        <div style={{ color: 'var(--text-sub)' }}>캡처하면 여기서 편집할 수 있어요</div>
      )}
    </div>
  )
}
