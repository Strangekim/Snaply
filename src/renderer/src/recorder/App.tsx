import { useTheme } from '../common/useTheme'

export function App(): React.JSX.Element {
  useTheme()
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        borderRadius: 'var(--radius-capsule)',
        background: 'var(--overlay-glass)',
        border: '1px solid var(--overlay-glass-border)',
        color: 'var(--overlay-text)',
        backdropFilter: 'blur(12px)',
        WebkitAppRegion: 'drag'
      } as React.CSSProperties}
    >
      녹화 기능은 준비 중이에요
    </div>
  )
}
