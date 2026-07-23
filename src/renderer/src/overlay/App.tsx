import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../common/i18n'
import type { CaptureMode, RegionRect } from '@shared/ipc'
import { overlayCss } from './glass'
import { DisplayPicker } from './DisplayPicker'
import { ModeCapsule } from './ModeCapsule'
import { RegionSelect } from './RegionSelect'
import { WindowPicker } from './WindowPicker'
import type { OverlayMode, Rect, Session, WindowSource } from './types'

function toOverlayMode(mode: CaptureMode): OverlayMode {
  if (mode === 'window') return 'window'
  if (mode === 'fullscreen') return 'fullscreen'
  if (mode === 'scrolling') return 'scrolling'
  // 'region' | 'all-in-one'
  return 'region'
}

/**
 * 오버레이 루트 — 디스플레이당 오버레이 창 1개 구조.
 * 이 창은 event:overlayStart로 받은 자기 디스플레이의 프레임만 렌더링한다.
 * (혼합 DPI 멀티 모니터에서 하나의 스팬 창은 OS가 잘라버리는 문제가 있어 창을 분리했다)
 */
export function App(): React.JSX.Element {
  const { t } = useI18n()
  const [session, setSession] = useState<Session | null>(null)
  const [showCapsule, setShowCapsule] = useState(false)
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
      const display = payload.display
      if (!display) return
      setSession({
        mode: payload.mode,
        frames: payload.frozenFrames,
        displays: [display],
        originX: display.bounds.x,
        originY: display.bounds.y
      })
      setShowCapsule(payload.showCapsule ?? true)
      setMode(toOverlayMode(payload.mode))
      setInteracting(false)
    })
    const offCancel = window.snaply.on('event:overlayCancel', () => {
      setSession(null)
      setInteracting(false)
    })
    // 다른 창의 캡슐에서 모드가 바뀌면 이 창도 동기화
    const offMode = window.snaply.on('event:overlayMode', (m) => {
      committing.current = false
      setMode(toOverlayMode(m))
      setInteracting(false)
    })
    return () => {
      offStart()
      offCancel()
      offMode()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  // 창 로컬 Rect → 디스플레이 로컬 좌표(DIP)의 RegionRect 변환 (이 창 = 디스플레이 1개)
  const toRegionRect = useCallback(
    (rect: Rect): RegionRect | null => {
      if (!session) return null
      const display = session.displays[0]
      const x1 = Math.max(rect.x, 0)
      const y1 = Math.max(rect.y, 0)
      const x2 = Math.min(rect.x + rect.w, display.bounds.width)
      const y2 = Math.min(rect.y + rect.h, display.bounds.height)
      if (x2 - x1 < 1 || y2 - y1 < 1) return null
      return { x: x1, y: y1, width: x2 - x1, height: y2 - y1, displayId: display.id }
    },
    [session]
  )

  // 영역 확정 → 커밋. 클립보드 버튼이면 결과를 클립보드에도 복사
  const commitRegion = useCallback(
    (rect: Rect, toClipboard: boolean) => {
      if (!session || committing.current) return
      const region = toRegionRect(rect)
      if (!region) return
      committing.current = true
      setSession(null)
      void window.snaply
        .invoke('capture:commitRegion', region)
        .then(async (result) => {
          if (toClipboard) {
            await window.snaply.invoke('clipboard:writeImage', { filePath: result.filePath })
          }
        })
        .catch(() => {
          committing.current = false
        })
    },
    [session, toRegionRect]
  )

  // 스크롤 캡처: 영역 확정 → 메인이 오버레이를 숨기고 자동 스크롤+스티칭 수행
  const commitScrolling = useCallback(
    (rect: Rect, toClipboard: boolean) => {
      if (!session || committing.current) return
      const region = toRegionRect(rect)
      if (!region) return
      committing.current = true
      setSession(null)
      void window.snaply
        .invoke('capture:scrolling:start', region)
        .then(async (result) => {
          if (toClipboard) {
            await window.snaply.invoke('clipboard:writeImage', { filePath: result.filePath })
          }
        })
        .catch(() => {
          committing.current = false
        })
    },
    [session, toRegionRect]
  )

  // 지연 캡처: 현재 모드로 delayMs 재시작 (메인이 오버레이를 닫고 카운트다운 후 재진입)
  const selectDelay = useCallback(
    (seconds: number) => {
      if (!session) return
      void window.snaply.invoke('capture:start', { mode, delayMs: seconds * 1000 })
    },
    [session, mode]
  )

  const changeMode = useCallback((m: OverlayMode) => {
    setMode(m)
    // 다른 디스플레이의 오버레이 창들도 같은 모드로 전환
    void window.snaply.invoke('overlay:setMode', m)
  }, [])

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

  if (!session) return <></>

  const display = session.displays[0]
  const frame = session.frames[0]

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <style>{overlayCss}</style>

      {/* 프리즈 프레임 (이 창의 디스플레이) */}
      {frame && (
        <img
          src={frame.dataUrl}
          draggable={false}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: display.bounds.width,
            height: display.bounds.height,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* 딤 처리 */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--overlay-dim)', pointerEvents: 'none' }} />

      {/* 모드별 캡처 UI */}
      {(mode === 'region' || mode === 'scrolling') && (
        <RegionSelect
          session={session}
          onCommit={mode === 'scrolling' ? commitScrolling : commitRegion}
          onCancel={cancel}
          onInteractingChange={setInteracting}
          commitLabel={mode === 'scrolling' ? t('⇊ 스크롤 캡처') : undefined}
          idleHint={
            mode === 'scrolling'
              ? t('스크롤 캡처할 영역을 드래그로 선택해 주세요 · 시작하면 자동으로 스크롤돼요 · ESC 취소')
              : undefined
          }
        />
      )}
      {/* 창 목록은 캡슐이 있는(커서) 디스플레이에만 표시 */}
      {mode === 'window' && showCapsule && <WindowPicker onPick={commitWindow} />}
      {/* 전체 화면: 각 디스플레이 창에 자기 카드 표시 — 클릭한 화면을 캡처 */}
      {mode === 'fullscreen' && <DisplayPicker session={session} onPick={commitFullscreen} />}

      {/* 캡처 모드 캡슐 (커서 디스플레이에만, 드래그/조정 중에는 숨김) */}
      {showCapsule && !interacting && (
        <ModeCapsule mode={mode} onChange={changeMode} onCancel={cancel} onDelaySelect={selectDelay} />
      )}
    </div>
  )
}
