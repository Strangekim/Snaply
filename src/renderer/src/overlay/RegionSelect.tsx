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
    return {
      x: Math.min(Math.max(r.x + dx, -r.w + MIN_SIZE), window.innerWidth - MIN_SIZE),
      y: Math.min(Math.max(r.y + dy, -r.h + MIN_SIZE), window.innerHeight - MIN_SIZE),
      w: r.w,
      h: r.h
    }
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
}

/** 영역 선택: 십자선 + 돋보기 → 드래그 → 조정 단계(8방향 핸들 + 이동 + 액션바) */
export function RegionSelect({
  session,
  onCommit,
  onCancel,
  onInteractingChange,
  commitLabel,
  idleHint,
  initialRect
}: RegionSelectProps): React.JSX.Element {
  const { t } = useI18n()
  const [phase, setPhase] = useState<Phase>('idle')
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)
  const [sel, setSel] = useState<Rect | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const adjustDrag = useRef<AdjustDrag | null>(null)

  useEffect(() => {
    onInteractingChange(phase !== 'idle')
  }, [phase, onInteractingChange])

  // 고정 크기 캡처: 캡슐에서 지정한 W×H 영역으로 바로 조정 단계 진입 (위치만 옮기고 Enter/✓)
  useEffect(() => {
    if (initialRect) {
      setSel(initialRect)
      setPhase('adjust')
    }
  }, [initialRect])

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

  const onMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return
    // idle 또는 조정 단계에서 선택 영역 밖 클릭 → 새로 드래그 시작
    dragStart.current = { x: e.clientX, y: e.clientY }
    setSel({ x: e.clientX, y: e.clientY, w: 0, h: 0 })
    setPhase('drag')
  }

  const onMouseMove = (e: React.MouseEvent): void => {
    setMouse({ x: e.clientX, y: e.clientY })
    if (phase === 'drag' && dragStart.current) {
      setSel(normalize(dragStart.current.x, dragStart.current.y, e.clientX, e.clientY))
    } else if (adjustDrag.current) {
      setSel(applyAdjust(adjustDrag.current, e.clientX, e.clientY))
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
    adjustDrag.current = null
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
    >
      {/* 십자선 (선택 전/드래그 중) */}
      {phase !== 'adjust' && mouse && (
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

      {/* 돋보기 (선택 전/드래그 중) */}
      {phase !== 'adjust' && mouse && <Magnifier session={session} mouse={mouse} />}

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
          {idleHint ?? t('드래그해서 캡처할 영역을 선택해 주세요 · ESC 취소')}
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
