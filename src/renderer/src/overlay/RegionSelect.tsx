import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../common/i18n'
import { glassCapsule } from './glass'
import { Magnifier } from './Magnifier'
import type { Rect, Session } from './types'

type Phase = 'idle' | 'drag' | 'adjust'

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const HANDLE_IDS: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const HANDLE_CURSOR: Record<HandleId, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize'
}

interface AdjustDrag {
  handle: HandleId | 'move'
  startX: number
  startY: number
  startRect: Rect
}

const MIN_SIZE = 4
const HANDLE_SIZE = 10

function normalize(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
}

function applyAdjust(drag: AdjustDrag, mx: number, my: number): Rect {
  const dx = mx - drag.startX
  const dy = my - drag.startY
  const r = drag.startRect
  if (drag.handle === 'move') {
    // 클램프하지 않는다 — 창 밖(다른 모니터)으로 끌고 나가면 syncRect 핸드오프로 이어진다
    return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }
  }
  let x1 = r.x
  let y1 = r.y
  let x2 = r.x + r.w
  let y2 = r.y + r.h
  if (drag.handle.includes('w')) x1 += dx
  if (drag.handle.includes('e')) x2 += dx
  if (drag.handle.includes('n')) y1 += dy
  if (drag.handle.includes('s')) y2 += dy
  return normalize(x1, y1, x2, y2)
}

function handlePosition(id: HandleId, sel: Rect): { left: number; top: number } {
  const cx = sel.x + sel.w / 2
  const cy = sel.y + sel.h / 2
  const x = id.includes('w') ? sel.x : id.includes('e') ? sel.x + sel.w : cx
  const y = id.includes('n') ? sel.y : id.includes('s') ? sel.y + sel.h : cy
  return { left: x - HANDLE_SIZE / 2, top: y - HANDLE_SIZE / 2 }
}

interface RegionSelectProps {
  session: Session
  onCommit: (rect: Rect, toClipboard: boolean) => void
  onCancel: () => void
  /** 드래그/조정 중인지 여부 (모드 캡슐 숨김 처리용) */
  onInteractingChange: (interacting: boolean) => void
  /** 확정 버튼 라벨 (기본 '✓ 캡처' — 스크롤 모드에서 교체) */
  commitLabel?: string
  /** idle 안내 문구 (기본 영역 캡처 안내) */
  idleHint?: string
  /** 고정 크기 캡처: 지정되면 해당 영역으로 즉시 조정 단계 진입 */
  initialRect?: Rect | null
  /** 이동 드래그 동기화 (모니터 간 핸드오프용) — rect는 이 창 로컬 좌표 */
  onSyncRect?: (rect: Rect, final: boolean) => void
  /** 값이 바뀌면 선택을 해제하고 idle로 (다른 모니터가 영역을 이어받았을 때) */
  resetSignal?: number
  /** 고정 크기 배치 모드: W×H 사각형이 마우스를 따라다니고 클릭으로 지정 */
  pendingSize?: { w: number; h: number } | null
  onPlacePreset?: (rect: Rect) => void
  /** 조정 단계의 현재 선택 영역 변경 알림 (지연 캡처가 이 영역을 자동 캡처하는 데 쓴다) */
  onSelChange?: (rect: Rect | null) => void
  /** 현재 영역을 저장 (반복 캡처 프리셋) */
  onSaveRegion?: (rect: Rect) => void
}

/** 영역 선택: 십자선 + 돋보기 → 드래그 → 조정 단계(8방향 핸들 + 이동 + 액션바) */
export function RegionSelect({
  session,
  onCommit,
  onCancel,
  onInteractingChange,
  commitLabel,
  idleHint,
  initialRect,
  onSyncRect,
  resetSignal,
  pendingSize,
  onPlacePreset,
  onSelChange,
  onSaveRegion
}: RegionSelectProps): React.JSX.Element {
  const { t } = useI18n()
  const [phase, setPhase] = useState<Phase>('idle')
  /** 방금 저장했다는 짧은 피드백 */
  const [savedFlash, setSavedFlash] = useState(false)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)
  const [sel, setSel] = useState<Rect | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const adjustDrag = useRef<AdjustDrag | null>(null)

  useEffect(() => {
    // 드래그 중에만 캡슐을 숨긴다 — 조정 단계에서는 캡슐(타이머·크기)을 쓸 수 있어야 한다
    onInteractingChange(phase === 'drag')
  }, [phase, onInteractingChange])

  // 조정 단계의 선택 영역을 부모에 알린다 (타이머 자동 캡처용)
  useEffect(() => {
    onSelChange?.(phase === 'adjust' && sel ? sel : null)
  }, [phase, sel, onSelChange])

  // 고정 크기 캡처: 캡슐에서 지정한 W×H 영역으로 바로 조정 단계 진입 (위치만 옮기고 Enter/✓)
  useEffect(() => {
    if (initialRect) {
      setSel(initialRect)
      setPhase('adjust')
    }
  }, [initialRect])

  // 다른 모니터가 영역을 이어받으면 이 창의 선택은 해제한다
  useEffect(() => {
    if (resetSignal && resetSignal > 0) {
      setSel(null)
      setPhase('idle')
      dragStart.current = null
      adjustDrag.current = null
    }
  }, [resetSignal])

  // 조정 단계: Enter로 캡처 확정
  useEffect(() => {
    if (phase !== 'adjust') return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && sel) {
        e.preventDefault()
        onCommit(sel, false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, sel, onCommit])

  const beginAdjustDrag = useCallback(
    (handle: HandleId | 'move') =>
      (e: React.MouseEvent): void => {
        if (e.button !== 0 || !sel) return
        e.stopPropagation()
        adjustDrag.current = { handle, startX: e.clientX, startY: e.clientY, startRect: sel }
      },
    [sel]
  )

  /** 배치 모드: 마우스 중심의 W×H 사각형 (창 안으로 클램프) */
  const placementRect = (mx: number, my: number): Rect | null => {
    if (!pendingSize) return null
    const w = Math.min(pendingSize.w, window.innerWidth)
    const h = Math.min(pendingSize.h, window.innerHeight)
    const x = Math.min(Math.max(0, Math.round(mx - w / 2)), window.innerWidth - w)
    const y = Math.min(Math.max(0, Math.round(my - h / 2)), window.innerHeight - h)
    return { x, y, w, h }
  }

  const onMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return
    // 고정 크기 배치 모드: 클릭한 위치에 영역 지정 → 조정 단계
    if (pendingSize) {
      const rect = placementRect(e.clientX, e.clientY)
      if (rect) onPlacePreset?.(rect)
      return
    }
    // idle 또는 조정 단계에서 선택 영역 밖 클릭 → 새로 드래그 시작
    dragStart.current = { x: e.clientX, y: e.clientY }
    setSel({ x: e.clientX, y: e.clientY, w: 0, h: 0 })
    setPhase('drag')
  }

  /** 이동 드래그 동기화 스로틀 (모니터 간 미리보기) */
  const lastSyncAt = useRef(0)

  const onMouseMove = (e: React.MouseEvent): void => {
    setMouse({ x: e.clientX, y: e.clientY })
    if (phase === 'drag' && dragStart.current) {
      setSel(normalize(dragStart.current.x, dragStart.current.y, e.clientX, e.clientY))
    } else if (adjustDrag.current) {
      const next = applyAdjust(adjustDrag.current, e.clientX, e.clientY)
      setSel(next)
      // 이동 드래그는 다른 모니터 오버레이에 미리보기를 중계한다 (30ms 스로틀)
      if (adjustDrag.current.handle === 'move' && onSyncRect) {
        const now = performance.now()
        if (now - lastSyncAt.current > 30) {
          lastSyncAt.current = now
          onSyncRect(next, false)
        }
      }
    }
  }

  const onMouseUp = (): void => {
    if (phase === 'drag') {
      dragStart.current = null
      if (sel && sel.w >= MIN_SIZE && sel.h >= MIN_SIZE) {
        setPhase('adjust')
      } else {
        setSel(null)
        setPhase('idle')
      }
    }
    // 이동 드래그 종료 → 최종 위치를 중계 (중심이 다른 모니터면 그쪽 창이 이어받는다)
    if (adjustDrag.current?.handle === 'move' && sel && onSyncRect) {
      onSyncRect(sel, true)
    }
    adjustDrag.current = null
  }

  /** 마우스가 이 창을 떠나면 십자선/돋보기를 지운다 (다른 모니터로 넘어갈 때 잔상 방지) */
  const onMouseLeave = (): void => {
    setMouse(null)
  }

  // 크기 배지 위치 (선택 영역 위, 화면 밖으로 나가지 않게)
  const badgeTop = sel ? Math.max(8, sel.y - 36) : 0

  // 액션바 위치: 기본은 선택 영역 아래 중앙, 공간이 없으면 위 → 그래도 없으면 안쪽
  let barTop = 0
  if (sel) {
    barTop = sel.y + sel.h + 12
    if (barTop + 60 > window.innerHeight) barTop = sel.y - 64
    if (barTop < 8) barTop = sel.y + sel.h - 64
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, cursor: phase === 'adjust' ? 'default' : 'crosshair' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* 고정 크기 배치 프리뷰: 마우스를 따라다니는 W×H 사각형 — 클릭하면 지정 */}
      {pendingSize && mouse && phase === 'idle' && (() => {
        const rect = placementRect(mouse.x, mouse.y)
        if (!rect) return null
        return (
          <div
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              outline: '2px solid var(--primary)',
              overflow: 'hidden',
              pointerEvents: 'none'
            }}
          >
            {session.frames.map((f) => {
              const d = session.displays.find((dd) => dd.id === f.displayId)
              if (!d) return null
              return (
                <img
                  key={f.displayId}
                  src={f.dataUrl}
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: -rect.x,
                    top: -rect.y,
                    width: d.bounds.width,
                    height: d.bounds.height
                  }}
                />
              )
            })}
          </div>
        )
      })()}
      {pendingSize && mouse && phase === 'idle' && (
        <div
          style={{
            ...glassCapsule,
            position: 'absolute',
            left: Math.max(4, mouse.x - 40),
            top: Math.max(4, mouse.y - Math.min(pendingSize.h, window.innerHeight) / 2 - 40),
            padding: '4px 12px',
            fontSize: 'var(--text-caption)',
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'none'
          }}
        >
          {pendingSize.w} × {pendingSize.h}
        </div>
      )}

      {/* 십자선 (선택 전/드래그 중) */}
      {!pendingSize && phase !== 'adjust' && mouse && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: mouse.y,
              width: '100%',
              height: 1,
              background: 'var(--overlay-text-sub)',
              pointerEvents: 'none'
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: mouse.x,
              top: 0,
              width: 1,
              height: '100%',
              background: 'var(--overlay-text-sub)',
              pointerEvents: 'none'
            }}
          />
        </>
      )}

      {/* 선택 영역 (딤 위에 원본 프레임을 다시 그려 밝게 표시) */}
      {sel && sel.w > 0 && sel.h > 0 && (
        <div
          style={{
            position: 'absolute',
            left: sel.x,
            top: sel.y,
            width: sel.w,
            height: sel.h,
            outline: '2px solid var(--primary)',
            overflow: 'hidden',
            cursor: phase === 'adjust' ? 'move' : undefined,
            pointerEvents: phase === 'adjust' ? 'auto' : 'none'
          }}
          onMouseDown={phase === 'adjust' ? beginAdjustDrag('move') : undefined}
        >
          {session.frames.map((f) => {
            const d = session.displays.find((dd) => dd.id === f.displayId)
            if (!d) return null
            return (
              <img
                key={f.displayId}
                src={f.dataUrl}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: d.bounds.x - session.originX - sel.x,
                  top: d.bounds.y - session.originY - sel.y,
                  width: d.bounds.width,
                  height: d.bounds.height,
                  pointerEvents: 'none'
                }}
              />
            )
          })}
        </div>
      )}

      {/* 크기 배지 */}
      {sel && sel.w > 0 && sel.h > 0 && (
        <div
          style={{
            ...glassCapsule,
            position: 'absolute',
            left: Math.max(8, sel.x),
            top: badgeTop,
            padding: '4px 12px',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'none',
            zIndex: 20
          }}
        >
          {Math.round(sel.w)} × {Math.round(sel.h)}
        </div>
      )}

      {/* 조정 단계: 8방향 리사이즈 핸들 */}
      {phase === 'adjust' &&
        sel &&
        HANDLE_IDS.map((id) => {
          const pos = handlePosition(id, sel)
          return (
            <div
              key={id}
              style={{
                position: 'absolute',
                left: pos.left,
                top: pos.top,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                borderRadius: 3,
                background: 'var(--white)',
                border: '1.5px solid var(--primary)',
                boxShadow: 'var(--shadow-card)',
                cursor: HANDLE_CURSOR[id],
                zIndex: 25
              }}
              onMouseDown={beginAdjustDrag(id)}
            />
          )
        })}

      {/* 조정 단계: 액션바 */}
      {phase === 'adjust' && sel && (
        <div
          style={{
            ...glassCapsule,
            position: 'absolute',
            left: Math.min(Math.max(sel.x + sel.w / 2, 160), window.innerWidth - 160),
            top: barTop,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 6,
            zIndex: 40
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="ov-hover"
            style={{
              border: 'none',
              font: 'inherit',
              fontSize: 'var(--text-body-size)',
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: 'var(--radius-capsule)',
              padding: '8px 18px',
              background: 'var(--primary)',
              color: 'var(--white)',
              whiteSpace: 'nowrap'
            }}
            onClick={() => onCommit(sel, false)}
          >
            {commitLabel ?? t('✓ 캡처')}
          </button>
          <button
            type="button"
            className="ov-hover"
            style={{
              border: 'none',
              font: 'inherit',
              fontSize: 'var(--text-body-size)',
              cursor: 'pointer',
              borderRadius: 'var(--radius-capsule)',
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--overlay-text)',
              whiteSpace: 'nowrap'
            }}
            onClick={() => onCommit(sel, true)}
          >
            {t('📋 클립보드')}
          </button>
          {onSaveRegion && (
            <button
              type="button"
              className="ov-hover"
              title={t('이 영역을 저장해 두고 반복 캡처해요')}
              style={{
                border: 'none',
                font: 'inherit',
                fontSize: 'var(--text-body-size)',
                cursor: 'pointer',
                borderRadius: 'var(--radius-capsule)',
                padding: '8px 16px',
                background: 'transparent',
                color: savedFlash ? 'var(--primary)' : 'var(--overlay-text)',
                whiteSpace: 'nowrap'
              }}
              onClick={() => {
                onSaveRegion(sel)
                setSavedFlash(true)
                window.setTimeout(() => setSavedFlash(false), 1500)
              }}
            >
              {savedFlash ? t('★ 저장됨') : t('☆ 영역 저장')}
            </button>
          )}
          <button
            type="button"
            className="ov-hover"
            style={{
              border: 'none',
              font: 'inherit',
              fontSize: 'var(--text-body-size)',
              cursor: 'pointer',
              borderRadius: 'var(--radius-capsule)',
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--overlay-text-sub)',
              whiteSpace: 'nowrap'
            }}
            onClick={onCancel}
          >
            {t('✕ 취소')}
          </button>
        </div>
      )}

      {/* 돋보기 (선택 전/드래그 중 — 배치 모드에서는 숨김) */}
      {!pendingSize && phase !== 'adjust' && mouse && <Magnifier session={session} mouse={mouse} />}

      {/* 안내 문구 */}
      {phase === 'idle' && (
        <div
          style={{
            ...glassCapsule,
            position: 'fixed',
            left: '50%',
            bottom: 40,
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            fontSize: 'var(--text-body-size)',
            pointerEvents: 'none'
          }}
        >
          {pendingSize
            ? t('원하는 위치에서 클릭하면 이 크기로 지정돼요 · ESC 취소')
            : (idleHint ?? t('드래그해서 캡처할 영역을 선택해 주세요 · ESC 취소'))}
        </div>
      )}
      {phase === 'adjust' && (
        <div
          style={{
            ...glassCapsule,
            position: 'fixed',
            left: '50%',
            bottom: 40,
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            fontSize: 'var(--text-caption)',
            color: 'var(--overlay-text-sub)',
            pointerEvents: 'none'
          }}
        >
          {t('핸들을 끌어 크기를 조정하거나 영역을 이동할 수 있어요 · Enter 캡처 · ESC 취소')}
        </div>
      )}
    </div>
  )
}
