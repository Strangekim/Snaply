/** 단축키 캡처 입력 — "눌러서 변경" 클릭 후 키 조합을 누르면 Electron accelerator로 변환 */
import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'

interface Props {
  label: string
  value: string
  /** 다른 필드와의 중복 검사용 */
  otherValues: string[]
  onChange: (accelerator: string) => void
}

/** KeyboardEvent → Electron accelerator 문자열. 보조키 없는 단독 키는 PrintScreen/F키만 허용 */
export function eventToAccelerator(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string | null {
  const mods: string[] = []
  if (e.ctrlKey) mods.push('Control')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  if (e.metaKey) mods.push('Command')

  const key = e.key
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return null // 보조키 단독은 미완성

  let main: string | null = null
  if (key === 'PrintScreen') main = 'PrintScreen'
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) main = key
  else if (/^[a-zA-Z]$/.test(key)) main = key.toUpperCase()
  else if (/^[0-9]$/.test(key)) main = key
  else if (key === ' ') main = 'Space'
  else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) main = key.replace('Arrow', '')
  else if (['Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete', 'Backspace', 'Tab', 'Enter', 'Escape'].includes(key))
    main = key === 'Escape' ? 'Esc' : key
  else if (e.code.startsWith('Numpad')) main = `num${e.code.slice(6).toLowerCase()}`
  else if (/^[`\-=[\]\\;',./]$/.test(key)) main = key

  if (!main) return null
  // 보조키가 없으면 PrintScreen/F키/Insert만 허용 (일반 키 단독은 다른 입력을 막는다)
  if (mods.length === 0 && !(main === 'PrintScreen' || /^F\d+$/.test(main) || main === 'Insert')) return null
  return [...mods, main].join('+')
}

export function HotkeyField({ label, value, otherValues, onChange }: Props): JSX.Element {
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        setCapturing(false)
        setError(null)
        return
      }
      const acc = eventToAccelerator(e)
      if (!acc) return
      if (otherValues.includes(acc)) {
        setError('이미 다른 기능이 쓰고 있어요')
        return
      }
      setError(null)
      setCapturing(false)
      onChange(acc)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing, otherValues, onChange])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 48 }}>
      <div style={{ flex: 1, color: 'var(--text-body)' }}>{label}</div>
      {error && capturing && (
        <span style={{ color: 'var(--danger)', fontSize: 'var(--text-caption)' }}>{error}</span>
      )}
      <button
        ref={ref}
        type="button"
        onClick={() => {
          setCapturing((c) => !c)
          setError(null)
        }}
        aria-label={`${label} 단축키 변경`}
        style={{
          minWidth: 160,
          height: 40,
          padding: '0 var(--space-4)',
          borderRadius: 'var(--radius-input)',
          border: capturing ? '2px solid var(--primary)' : '1px solid var(--border-divider)',
          background: capturing ? 'var(--primary-bg)' : 'var(--bg-input)',
          color: capturing ? 'var(--primary)' : 'var(--text-title)',
          fontFamily: 'var(--font)',
          fontSize: 'var(--text-body-size)',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all var(--transition-fast)'
        }}
      >
        {capturing ? '키를 눌러 주세요 · ESC 취소' : value || '설정 안 함'}
      </button>
    </div>
  )
}
