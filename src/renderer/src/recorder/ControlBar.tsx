/** 녹화 중 컨트롤바 — 다크 글래스 캡슐 420×72, 드래그로 이동 가능. 소유자: Recorder */
import type { JSX } from 'react'
import { formatElapsed } from './engine'
import { IconClose, IconPause, IconPlay, IconStop } from './icons'
import styles from './recorder.module.css'

interface ControlBarProps {
  elapsedMs: number
  paused: boolean
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onCancel: () => void
}

export function ControlBar({
  elapsedMs,
  paused,
  onPause,
  onResume,
  onStop,
  onCancel
}: ControlBarProps): JSX.Element {
  return (
    <div className={styles.capsule}>
      <span className={`${styles.recDot} ${paused ? styles.recDotPaused : ''}`} />
      <span className={styles.elapsed}>{formatElapsed(elapsedMs)}</span>
      <span className={styles.capsuleSpacer} />
      <button
        type="button"
        className={styles.capsuleButton}
        aria-label={paused ? '재개' : '일시정지'}
        onClick={paused ? onResume : onPause}
      >
        {paused ? <IconPlay /> : <IconPause />}
      </button>
      <button
        type="button"
        className={`${styles.capsuleButton} ${styles.stopButton}`}
        aria-label="정지"
        onClick={onStop}
      >
        <IconStop />
      </button>
      <button type="button" className={styles.capsuleButton} aria-label="녹화 취소" onClick={onCancel}>
        <IconClose />
      </button>
    </div>
  )
}
