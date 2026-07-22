import { useCallback, useEffect, useRef, useState } from 'react'
import type { CaptureMode, DisplayInfo } from '@shared/ipc'

interface Session {
  mode: CaptureMode
  frames: Array<{ displayId: number; dataUrl: string }>
  displays: DisplayInfo[]
  originX: number
  originY: number
}

interface DragState {
  startX: number
  startY: number
  x: number
  y: number
}

/** Phase 0 기본 오버레이: 프리즈 화면 + 드래그 영역 선택. Phase 1에서 고도화 예정 */
export function App(): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const committing = useRef(false)

  useEffect(() => {
    const offStart = window.snaply.on('event:overlayStart', (payload) => {
      committing.current = false
      void window.snaply.invoke('capture:listDisplays', undefined).then((displays) => {
        const originX = Math.min(...displays.map((d) => d.bounds.x))
        const originY = Math.min(...displays.map((d) => d.bounds.y))
        setSession({ mode: payload.mode, frames: payload.frozenFrames, displays, originX, originY })
        setDrag(null)
      })
    })
    const offCancel = window.snaply.on('event:overlayCancel', () => {
      setSession(null)
      setDrag(null)
    })
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setSession(null)
        setDrag(null)
        void window.snaply.invoke('capture:cancel', undefined)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      offStart()
      offCancel()
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const commit = useCallback(
    (d: DragState) => {
      if (!session || committing.current) return
      const x = Math.min(d.startX, d.x)
      const y = Math.min(d.startY, d.y)
      const width = Math.abs(d.x - d.startX)
      const height = Math.abs(d.y - d.startY)
      if (width < 4 || height < 4) {
        setDrag(null)
        return
      }
      // 선택 중심이 속한 디스플레이 기준으로 좌표 변환
      const cx = x + width / 2 + session.originX
      const cy = y + height / 2 + session.originY
      const display =
        session.displays.find(
          (dd) =>
            cx >= dd.bounds.x && cx < dd.bounds.x + dd.bounds.width && cy >= dd.bounds.y && cy < dd.bounds.y + dd.bounds.height
        ) ?? session.displays[0]
      committing.current = true
      setSession(null)
      setDrag(null)
      void window.snaply.invoke('capture:commitRegion', {
        x: x + session.originX - display.bounds.x,
        y: y + session.originY - display.bounds.y,
        width,
        height,
        displayId: display.id
      })
    },
    [session]
  )

  if (!session) return <></>

  const sel = drag
    ? {
        x: Math.min(drag.startX, drag.x),
        y: Math.min(drag.startY, drag.y),
        w: Math.abs(drag.x - drag.startX),
        h: Math.abs(drag.y - drag.startY)
      }
    : null

  return (
    <div
      style={{ position: 'fixed', inset: 0, cursor: 'crosshair' }}
      onMouseDown={(e) => setDrag({ startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => drag && setDrag({ ...drag, x: e.clientX, y: e.clientY })}
      onMouseUp={() => drag && commit(drag)}
    >
      {session.frames.map((f) => {
        const d = session.displays.find((dd) => dd.id === f.displayId)
        if (!d) return null
        return (
          <img
            key={f.displayId}
            src={f.dataUrl}
            style={{
              position: 'absolute',
              left: d.bounds.x - session.originX,
              top: d.bounds.y - session.originY,
              width: d.bounds.width,
              height: d.bounds.height,
              pointerEvents: 'none'
            }}
          />
        )
      })}
      {/* 딤 처리 */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--overlay-dim)', pointerEvents: 'none' }} />
      {/* 선택 영역 */}
      {sel && (
        <div
          style={{
            position: 'absolute',
            left: sel.x,
            top: sel.y,
            width: sel.w,
            height: sel.h,
            outline: '2px solid var(--primary)',
            background: 'transparent',
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
                style={{
                  position: 'absolute',
                  left: d.bounds.x - session.originX - sel.x,
                  top: d.bounds.y - session.originY - sel.y,
                  width: d.bounds.width,
                  height: d.bounds.height
                }}
              />
            )
          })}
        </div>
      )}
      {sel && sel.w > 0 && (
        <div
          style={{
            position: 'absolute',
            left: sel.x,
            top: Math.max(4, sel.y - 34),
            padding: '4px 12px',
            borderRadius: 'var(--radius-capsule)',
            background: 'var(--overlay-glass)',
            color: 'var(--overlay-text)',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)'
          }}
        >
          {sel.w} × {sel.h}
        </div>
      )}
      {!drag && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 32,
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            borderRadius: 'var(--radius-capsule)',
            background: 'var(--overlay-glass)',
            border: '1px solid var(--overlay-glass-border)',
            color: 'var(--overlay-text)',
            fontSize: 'var(--text-body-size)',
            backdropFilter: 'blur(12px)',
            pointerEvents: 'none'
          }}
        >
          드래그해서 영역을 선택하세요 · ESC 취소
        </div>
      )}
    </div>
  )
}
