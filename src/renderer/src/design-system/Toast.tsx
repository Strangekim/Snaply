import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import styles from './Toast.module.css'
import type { ToastContextValue, ToastItem, ToastOptions, ToastProviderProps } from './types'

const DEFAULT_DURATION_MS = 3000
/** 퇴장 애니메이션 시간 — --transition-base(200ms)와 맞춤 */
const LEAVE_DURATION_MS = 200

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast는 <ToastProvider> 안에서만 사용할 수 있어요.')
  }
  return context
}

export function ToastProvider({ children }: ToastProviderProps): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const toast = useCallback((message: string, options?: ToastOptions) => {
    const id = nextId.current++
    const duration = options?.duration ?? DEFAULT_DURATION_MS
    setToasts((prev) => [...prev, { id, message, type: options?.type ?? 'success', leaving: false }])

    timers.current.push(
      window.setTimeout(() => {
        setToasts((prev) =>
          prev.map((item) => (item.id === id ? { ...item, leaving: true } : item))
        )
      }, duration),
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id))
      }, duration + LEAVE_DURATION_MS)
    )
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div className={styles.container} role="status" aria-live="polite">
            {toasts.map((item) => (
              <div
                key={item.id}
                className={`${styles.capsule} ${item.leaving ? styles.leaving : ''}`}
              >
                <ToastIcon type={item.type} />
                <span className={styles.message}>{item.message}</span>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  )
}

function ToastIcon({ type }: { type: ToastItem['type'] }): JSX.Element | null {
  if (type === 'success') {
    return (
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="11" className={styles.successCircle} />
        <path d="M7 12.5l3.5 3.5L17 9" className={styles.successCheck} />
      </svg>
    )
  }
  if (type === 'error') {
    return (
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="11" className={styles.errorCircle} />
        <path d="M12 7v6" className={styles.errorMark} />
        <circle cx="12" cy="16.5" r="1.2" className={styles.errorDot} />
      </svg>
    )
  }
  return null
}
