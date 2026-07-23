/** 정지 후 트리밍 프리뷰 — blob 재생 + 시작/끝 핸들. 소유자: Recorder */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { Button, Card } from '@ds/index'
import { useI18n } from '../common/i18n'
import { formatElapsed } from './engine'
import { IconPlay } from './icons'
import styles from './recorder.module.css'

interface TrimPreviewProps {
  blobUrl: string
  durationMs: number
  trim: [number, number]
  onTrimChange: (trim: [number, number]) => void
  onSave: () => void
  onRetake: () => void
  saving: boolean
}

export function TrimPreview({
  blobUrl,
  durationMs,
  trim,
  onTrimChange,
  onSave,
  onRetake,
  saving
}: TrimPreviewProps): JSX.Element {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [trimStart, trimEnd] = trim
  const max = Math.max(durationMs, 1)

  // MediaRecorder가 만든 WebM은 duration 메타데이터가 없어 Infinity로 나온다 — 강제 보정
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onMeta = (): void => {
      if (video.duration === Infinity) {
        video.currentTime = 1e10
        const onDur = (): void => {
          video.currentTime = trimStart / 1000
          video.removeEventListener('durationchange', onDur)
        }
        video.addEventListener('durationchange', onDur)
      }
    }
    video.addEventListener('loadedmetadata', onMeta)
    return () => video.removeEventListener('loadedmetadata', onMeta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobUrl])

  // 트리밍 구간 안에서만 재생 (끝에 닿으면 시작으로 되감고 정지)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = (): void => {
      if (video.currentTime * 1000 >= trimEnd - 40) {
        video.pause()
        video.currentTime = trimStart / 1000
      }
    }
    const onPlay = (): void => setPlaying(true)
    const onPause = (): void => setPlaying(false)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [trimStart, trimEnd])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      if (video.currentTime * 1000 < trimStart || video.currentTime * 1000 >= trimEnd - 40) {
        video.currentTime = trimStart / 1000
      }
      void video.play()
    } else {
      video.pause()
    }
  }, [trimStart, trimEnd])

  const seekPreview = useCallback((ms: number) => {
    const video = videoRef.current
    if (video && Number.isFinite(ms)) video.currentTime = ms / 1000
  }, [])

  const handleStartChange = useCallback(
    (value: number) => {
      const next = Math.min(value, trimEnd - 100)
      onTrimChange([Math.max(0, next), trimEnd])
      seekPreview(next)
    },
    [trimEnd, onTrimChange, seekPreview]
  )

  const handleEndChange = useCallback(
    (value: number) => {
      const next = Math.max(value, trimStart + 100)
      onTrimChange([trimStart, Math.min(max, next)])
      seekPreview(next)
    },
    [trimStart, max, onTrimChange, seekPreview]
  )

  return (
    <div className={styles.panelRoot}>
      <Card padding="lg" className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.cardTitle}>{t('확인하고 저장해요')}</h1>
        </div>

        <div
          className={styles.previewVideoWrap}
          onClick={togglePlay}
          role="button"
          aria-label={playing ? '일시정지' : '재생'}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className={styles.previewVideo} src={blobUrl} />
          {!playing && (
            <span className={styles.previewPlayBadge}>
              <IconPlay size={44} />
            </span>
          )}
        </div>

        <div className={styles.trimArea}>
          <div className={styles.fieldLabel}>{t('트리밍')}</div>
          <div className={styles.trimTrack}>
            <div className={styles.trimRail} />
            <div
              className={styles.trimFill}
              style={{
                left: `${(trimStart / max) * 100}%`,
                width: `${((trimEnd - trimStart) / max) * 100}%`
              }}
            />
            <input
              className={styles.trimRange}
              type="range"
              aria-label="시작 지점"
              min={0}
              max={max}
              step={50}
              value={trimStart}
              onChange={(e) => handleStartChange(Number(e.target.value))}
            />
            <input
              className={styles.trimRange}
              type="range"
              aria-label="끝 지점"
              min={0}
              max={max}
              step={50}
              value={trimEnd}
              onChange={(e) => handleEndChange(Number(e.target.value))}
            />
          </div>
          <div className={styles.trimLabels}>
            <span>{formatElapsed(trimStart)}</span>
            <span>{t('{d} 저장돼요', { d: formatElapsed(trimEnd - trimStart) })}</span>
            <span>{formatElapsed(trimEnd)}</span>
          </div>
        </div>

        <div className={styles.previewActions}>
          <Button variant="secondary" onClick={onRetake} disabled={saving}>
            {t('다시 찍기')}
</Button>
          <Button onClick={onSave} loading={saving}>
            {t('저장하기')}
</Button>
        </div>
      </Card>
    </div>
  )
}
