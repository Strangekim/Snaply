import { useState } from 'react'
import { useI18n } from '../common/i18n'
import { glassButton, glassCapsule } from './glass'
import type { OverlayMode } from './types'

const SEGMENTS: Array<{ id: OverlayMode; label: string }> = [
  { id: 'region', label: '영역' },
  { id: 'window', label: '창' },
  { id: 'fullscreen', label: '전체 화면' },
  { id: 'scrolling', label: '스크롤' }
]

/** 지연 캡처 선택지 (초) */
const DELAY_SECONDS = [3, 5, 10]

/** 자주 쓰는 고정 캡처 크기 프리셋 */
const SIZE_PRESETS: Array<{ w: number; h: number; label?: string }> = [
  { w: 1920, h: 1080, label: 'FHD' },
  { w: 1280, h: 720, label: 'HD' },
  { w: 1080, h: 1080 },
  { w: 800, h: 600 },
  { w: 640, h: 480 },
  { w: 300, h: 400 }
]

interface ModeCapsuleProps {
  mode: OverlayMode
  onChange: (mode: OverlayMode) => void
  onCancel: () => void
  /** 지연 캡처 선택: 현재 모드로 delayMs 재시작 */
  onDelaySelect: (seconds: number) => void
  /** 고정 크기 적용: W×H 선택 영역을 화면 중앙에 생성 (영역/스크롤 모드) */
  onSizeApply?: (w: number, h: number) => void
}

/** 오버레이 상단 중앙의 캡처 모드 전환 캡슐 툴바 (+ 지연 캡처 타이머) */
export function ModeCapsule({
  mode,
  onChange,
  onCancel,
  onDelaySelect,
  onSizeApply
}: ModeCapsuleProps): React.JSX.Element {
  const { t } = useI18n()
  const [delayOpen, setDelayOpen] = useState(false)
  const [sizeOpen, setSizeOpen] = useState(false)
  const [widthInput, setWidthInput] = useState('300')
  const [heightInput, setHeightInput] = useState('400')

  const showSize = (mode === 'region' || mode === 'scrolling') && onSizeApply != null

  const applySize = (w: number, h: number): void => {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 4 || h < 4) return
    setSizeOpen(false)
    setWidthInput(String(Math.round(w)))
    setHeightInput(String(Math.round(h)))
    onSizeApply?.(Math.round(w), Math.round(h))
  }

  const sizeInputStyle: React.CSSProperties = {
    width: 72,
    height: 34,
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid var(--overlay-glass-border)',
    background: 'transparent',
    color: 'var(--overlay-text)',
    font: 'inherit',
    fontSize: 'var(--text-body-size)',
    textAlign: 'center',
    outline: 'none'
  }

  return (
    <div
      style={{
        ...glassCapsule,
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: 6,
        zIndex: 50
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {SEGMENTS.map((seg) => {
        const active = seg.id === mode
        return (
          <button
            key={seg.id}
            type="button"
            className={active ? undefined : 'ov-hover'}
            style={{
              ...glassButton,
              background: active ? 'var(--primary)' : 'transparent',
              color: active ? 'var(--white)' : 'var(--overlay-text-sub)',
              fontWeight: active ? 600 : 500
            }}
            onClick={() => onChange(seg.id)}
          >
            {t(seg.label)}
          </button>
        )
      })}
      <div style={{ width: 1, alignSelf: 'stretch', margin: '6px var(--space-1)', background: 'var(--overlay-glass-border)' }} />

      {/* 고정 크기: W×H 직접 입력 + 프리셋 (영역/스크롤 모드 전용) */}
      {showSize && (
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="ov-hover"
            title={t('고정 크기로 캡처해요')}
            style={{
              ...glassButton,
              padding: '8px 12px',
              color: sizeOpen ? 'var(--overlay-text)' : 'var(--overlay-text-sub)'
            }}
            onClick={() => {
              setSizeOpen((v) => !v)
              setDelayOpen(false)
            }}
          >
            ⊞ {t('크기')}
          </button>
          {sizeOpen && (
            <div
              style={{
                ...glassCapsule,
                position: 'absolute',
                top: 'calc(100% + 12px)',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                borderRadius: 16,
                zIndex: 55,
                minWidth: 280
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'center' }}>
                <input
                  type="number"
                  min={4}
                  value={widthInput}
                  onChange={(e) => setWidthInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applySize(Number(widthInput), Number(heightInput))
                  }}
                  aria-label={t('너비')}
                  style={sizeInputStyle}
                />
                <span style={{ color: 'var(--overlay-text-sub)' }}>×</span>
                <input
                  type="number"
                  min={4}
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applySize(Number(widthInput), Number(heightInput))
                  }}
                  aria-label={t('높이')}
                  style={sizeInputStyle}
                />
                <button
                  type="button"
                  className="ov-hover"
                  style={{
                    ...glassButton,
                    background: 'var(--primary)',
                    color: 'var(--white)',
                    fontWeight: 600,
                    padding: '8px 14px'
                  }}
                  onClick={() => applySize(Number(widthInput), Number(heightInput))}
                >
                  {t('적용')}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-1)' }}>
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={`${p.w}x${p.h}`}
                    type="button"
                    className="ov-hover"
                    style={{
                      ...glassButton,
                      padding: '8px 6px',
                      color: 'var(--overlay-text-sub)',
                      fontSize: 'var(--text-caption)',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={() => applySize(p.w, p.h)}
                  >
                    {p.w}×{p.h}
                    {p.label ? ` ${p.label}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 지연 캡처 타이머: 클릭 → 3/5/10초 팝오버 */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="ov-hover"
          title={t('지연 캡처')}
          style={{
            ...glassButton,
            padding: '8px 12px',
            color: delayOpen ? 'var(--overlay-text)' : 'var(--overlay-text-sub)'
          }}
          onClick={() => {
            setDelayOpen((v) => !v)
            setSizeOpen(false)
          }}
        >
          ⏱
        </button>
        {delayOpen && (
          <div
            style={{
              ...glassCapsule,
              position: 'absolute',
              top: 'calc(100% + 12px)',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: 6,
              zIndex: 55
            }}
          >
            {DELAY_SECONDS.map((s) => (
              <button
                key={s}
                type="button"
                className="ov-hover"
                style={{ ...glassButton, padding: '8px 14px', color: 'var(--overlay-text-sub)' }}
                onClick={() => {
                  setDelayOpen(false)
                  onDelaySelect(s)
                }}
              >
                {t('{n}초', { n: s })}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 1, alignSelf: 'stretch', margin: '6px var(--space-1)', background: 'var(--overlay-glass-border)' }} />
      <button
        type="button"
        className="ov-hover"
        style={{ ...glassButton, color: 'var(--overlay-text-sub)' }}
        onClick={onCancel}
      >
        {t('✕ 취소')}
      </button>
    </div>
  )
}
