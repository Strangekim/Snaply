import { useId } from 'react'
import type { JSX } from 'react'
import styles from './Input.module.css'
import type { InputProps } from './types'

export function Input({
  label,
  error,
  containerClassName,
  className,
  id,
  ...rest
}: InputProps): JSX.Element {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`

  return (
    <div className={[styles.root, containerClassName].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className={`${styles.field} ${error ? styles.fieldError : ''}`}>
        <input
          id={inputId}
          className={[styles.input, className].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
