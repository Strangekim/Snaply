import type { JSX } from 'react'
import styles from './Segmented.module.css'
import type { SegmentedProps } from './types'

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  fullWidth = false,
  size = 'md',
  className,
  'aria-label': ariaLabel
}: SegmentedProps<T>): JSX.Element {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[
        styles.segmented,
        size === 'sm' ? styles.sm : styles.md,
        fullWidth ? styles.fullWidth : undefined,
        className
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            className={`${styles.item} ${active ? styles.active : ''}`}
            onClick={() => {
              if (!active) onChange(option.value)
            }}
          >
            {option.icon && <span className={styles.icon}>{option.icon}</span>}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
