import { useCallback, useEffect, useRef, useState } from 'react'
import type { CaptureMode } from '@shared/ipc'
import { overlayCss } from './glass'
import { DisplayPicker } from './DisplayPicker'
import { ModeCapsule } from './ModeCapsule'
import { RegionSelect } from './RegionSelect'
import { WindowPicker } from './WindowPicker'
import type { OverlayMode, Rect, Session, WindowSource } from './types'

function toOverlayMode(mode: CaptureMode): OverlayMode {
  if (mode === 'window') return 'window'
  if (mode === 'fullscreen') return 'fullscreen'
  // 'region' | 'all-in-one' | 'scrolling'(Phase 2 전까지 영역으로 대체)
  return 'region'
}

/** 오버레이 루트: 프리즈 프레임 + 모드 캡슐 + 모드별 캡처 UI */
export function App(): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null)
  const [mode, setMode] = useState<OverlayMode>('region')
  const [interacting, setInteracting] = useState(false)
  const committing = useRef(false)

  const cancel = useCallback(() => {
    setSession(null)
    setInteracting(false)
    void window.snaply.invoke('capture:cancel', undefined)
  }, [])

  useEffect(() => {
    const offStart = window.snaply.on('event:overlayStart', (payload) => {
      committing.current = false
      void window.snaply.invoke('capture:listDisplays', undefined).then((displays) => {
        const originX = Math.min(...displays.map((d) => d.bounds.x))
        const originY = Math.min(...displays.map((d) => d.bounds.y))
        setSession({ mode: payload.mode, frames: payload.frozenFrames, displays, originX, originY })
        setMode(toOverlayMode(payload.mode))
        setInteracting(false)
      })
    })
    const offCancel = window.snaply.on('event:overlayCancel', () => {
      setSession(null)
      setInteracting(false)
    })
    return () => {
      offStart()
      offCancel()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  // 영역 확정 → 디스플레이 로컬 좌표(DIP)로 변환해 커밋. 클립보드 버튼이면 결과를 클립보드에도 복사
  const commitRegion = useCallback(
    (rect: Rect, toClipboard: boolean) => {
      if (!session || committing.current) return
      // 선택 중심이 속한 디스플레이 기준으로 좌표 변환
      const cx = rect.x + rect.w / 2 + session.originX
      const cy = rect.y + rect.h / 2 + session.originY
      const display =
        session.displays.find(
          (d) => cx >= d.bounds.x && cx < d.bounds.x + d.bounds.width && cy >= d.bounds.y && cy < d.bounds.y + d.bounds.height
        ) ?? session.displays[0]
      // 해당 디스플레이 경계로 클램프 (디스플레이를 벗어난 부분은 잘라냄)
      const gx1 = Math.max(rect.x + session.originX, display.bounds.x)
      const gy1 = Math.max(rect.y + session.originY, display.bounds.y)
      const gx2 = Math.min(rect.x + rect.w + session.originX, display.bounds.x + display.bounds.width)
      const gy2 = Math.min(rect.y + rect.h + session.originY, display.bounds.y + display.bounds.height)
      if (gx2 - gx1 < 1 || gy2 - gy1 < 1) return
      committing.current = true
      setSession(null)
      void window.snaply
        .invoke('capture:commitRegion', {
          x: gx1 - display.bounds.x,
          y: gy1 - display.bounds.y,
          width: gx2 - gx1,
          height: gy2 - gy1,
          displayId: display.id
        })
        .then(async (result) => {
          if (toClipboard) {
            await window.snaply.invoke('clipboard:writeImage', { filePath: result.filePath })
          }
        })
        .catch(() => {
          committing.current = false
        })
    },
    [session]
  )

  const commitWindow = useCallback((win: WindowSource) => {
    if (committing.current) return
    committing.current = true
    setSession(null)
    void window.snaply
      .invoke('capture:commitWindow', { sourceId: win.sourceId, title: win.title, appName: win.appName })
      .catch(() => {
        committing.current = false
      })
  }, [])

  const commitFullscreen = useCallback((displayId: number) => {
    if (committing.current) return
    committing.current = true
    setSession(null)
    void window.snaply.invoke('capture:commitFullscreen', { displayId }).catch(() => {
      committing.current = false
    })
  }, [])

  // 전체 화면 모드 + 모니터 1대 → 선택할 것이 없으므로 즉시 캡처
  useEffect(() => {
    if (session && mode === 'fullscreen' && session.displays.length === 1) {
      commitFullscreen(session.displays[0].id)
    }
  }, [session, mode, commitFullscreen])

  if (!session) return <></>

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <style>{overlayCss}</style>

      {/* 프리즈 프레임 (디스플레이별) */}
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

      {/* 모드별 캡처 UI */}
      {mode === 'region' && (
        <RegionSelect session={session} onCommit={commitRegion} onCancel={cancel} onInteractingChange={setInteracting} />
      )}
      {mode === 'window' && <WindowPicker onPick={commitWindow} />}
      {mode === 'fullscreen' && session.displays.length > 1 && <DisplayPicker session={session} onPick={commitFullscreen} />}

      {/* 캡처 모드 캡슐 (드래그/조정 중에는 숨김) */}
      {!interacting && <ModeCapsule mode={mode} onChange={setMode} onCancel={cancel} />}
    </div>
  )
}
