import type { JSX } from 'react'
import styles from './Card.module.css'
import type { CardProps } from './types'

export function Card({
  hoverable = false,
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps): JSX.Element {
  const classes = [
    styles.card,
    padding === 'lg' ? styles.paddingLg : styles.paddingMd,
    hoverable ? styles.hoverable : undefined,
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
