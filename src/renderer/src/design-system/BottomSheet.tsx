import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import styles from './BottomSheet.module.css'
import type { BottomSheetProps, SheetItemProps } from './types'

/** 닫힘 애니메이션 시간 — tokens.css의 --transition-base(200ms)와 맞춤 */
const CLOSE_DURATION_MS = 200

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className
}: BottomSheetProps): JSX.Element | null {
  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // 마운트 직후 한 프레임 뒤에 entered를 켜야 슬라이드업 트랜지션이 재생됨
      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setEntered(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
      }
    }
    setEntered(false)
    const timer = window.setTimeout(() => setMounted(false), CLOSE_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <div className={styles.root}>
      <div
        className={`${styles.dim} ${entered ? styles.dimVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[styles.sheet, entered ? styles.sheetVisible : undefined, className]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.grabber} aria-hidden="true" />
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={styles.content}>{children}</div>
      </div>
    </div>,
    document.body
  )
}

export function SheetItem({
  icon,
  title,
  description,
  selected = false,
  className,
  type = 'button',
  ...rest
}: SheetItemProps): JSX.Element {
  const classes = [styles.item, selected ? styles.itemSelected : undefined, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      {icon && <span className={styles.itemIcon}>{icon}</span>}
      <span className={styles.itemTexts}>
        <span className={styles.itemTitle}>{title}</span>
        {description && <span className={styles.itemDescription}>{description}</span>}
      </span>
    </button>
  )
}
