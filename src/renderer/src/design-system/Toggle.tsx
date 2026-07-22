import type { JSX } from 'react'
import styles from './Toggle.module.css'
import type { ToggleProps } from './types'

export function Toggle({
  checked,
  onChange,
  disabled = false,
  id,
  className,
  'aria-label': ariaLabel
}: ToggleProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={[styles.toggle, checked ? styles.on : undefined, className]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} aria-hidden="true" />
    </button>
  )
}
