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
  /** 고정 크기 캡처: 핸드오프로 넘어온 선택 영역 (RegionSelect가 adjust 단계로 이어받는다) */
  const [presetRect, setPresetRect] = useState<Rect | null>(null)
  /** 고정 크기 배치 모드: W×H 사각형이 마우스를 따라다니고 클릭으로 지정 (전 모니터 동기화) */
  const [pendingSize, setPendingSize] = useState<{ w: number; h: number } | null>(null)
  /** 지연 캡처 카운트다운 (남은 초) */
  const [countdown, setCountdown] = useState(0)
  /** 카운트다운 중 캡처 예정 영역 포커스 테두리 (이 창 로컬 좌표) */
  const [focusRect, setFocusRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  /** 다른 모니터에서 이동 중인 선택 영역의 미리보기 (이 창 로컬 좌표) */
  const [ghostRect, setGhostRect] = useState<Rect | null>(null)
  /** 다른 모니터가 영역을 이어받았을 때 이 창의 선택 해제 신호 */
  const [resetSignal, setResetSignal] = useState(0)
  const committing = useRef(false)
  const sessionRef = useRef<Session | null>(null)
  sessionRef.current = session

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
      setPresetRect(null)
      setPendingSize(null)
      setGhostRect(null)
    })
    const offCancel = window.snaply.on('event:overlayCancel', () => {
      setSession(null)
      setInteracting(false)
      setPresetRect(null)
      setPendingSize(null)
      setGhostRect(null)
    })
    // 고정 크기 배치 모드 on/off (모든 모니터 동기화)
    const offPreset = window.snaply.on('event:overlayPreset', (size) => {
      setPendingSize(size)
      if (size) setPresetRect(null)
    })
    // 지연 캡처 카운트다운 (이 창이 카운트다운 표시 담당일 때만 수신)
    const offCountdown = window.snaply.on('event:overlayCountdown', setCountdown)
    // 카운트다운 중 캡처 예정 영역 포커스 (해당 디스플레이 창만 수신)
    const offFocus = window.snaply.on('event:overlayFocusRegion', setFocusRect)
    // 다른 창의 캡슐에서 모드가 바뀌면 이 창도 동기화
    const offMode = window.snaply.on('event:overlayMode', (m) => {
      committing.current = false
      setMode(toOverlayMode(m))
      setInteracting(false)
      setPresetRect(null)
      setGhostRect(null)
    })
    // 선택 영역 모니터 간 이동: 미리보기(고스트) + 드롭 시 핸드오프
    const offRect = window.snaply.on('event:overlayRect', ({ rect, final, sourceDisplayId }) => {
      const current = sessionRef.current
      if (!current) return
      const b = current.displays[0].bounds
      if (sourceDisplayId === current.displays[0].id) {
        // 내가 보낸 이벤트: 드롭 시 중심이 내 화면을 떠났으면 내 선택을 해제
        if (final && rect) {
          const cx = rect.x + rect.width / 2
          const cy = rect.y + rect.height / 2
          const inMine = cx >= b.x && cx < b.x + b.width && cy >= b.y && cy < b.y + b.height
          if (!inMine) setResetSignal((n) => n + 1)
        }
        return
      }
      if (!rect) {
        setGhostRect(null)
        return
      }
      const local: Rect = { x: rect.x - b.x, y: rect.y - b.y, w: rect.width, h: rect.height }
      if (!final) {
        // 드래그 중: 내 화면과 겹치면 고스트 미리보기
        const intersects = local.x < b.width && local.y < b.height && local.x + local.w > 0 && local.y + local.h > 0
        setGhostRect(intersects ? local : null)
        return
      }
      // 드롭: 중심이 내 화면에 들어왔으면 영역을 이어받아 조정 단계로
      setGhostRect(null)
      const cx = rect.x + rect.width / 2
      const cy = rect.y + rect.height / 2
      const inMine = cx >= b.x && cx < b.x + b.width && cy >= b.y && cy < b.y + b.height
      if (inMine) setPresetRect(local)
    })
    return () => {
      offStart()
      offCancel()
      offPreset()
      offCountdown()
      offFocus()
      offMode()
      offRect()
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

  /** 조정 단계의 현재 선택 영역 (타이머 자동 캡처용 — RegionSelect가 갱신) */
  const currentSelRef = useRef<Rect | null>(null)
  const handleSelChange = useCallback((rect: Rect | null) => {
    currentSelRef.current = rect
  }, [])

  // 지연 캡처: 영역이 지정돼 있으면 카운트다운 후 그 영역을 자동 캡처,
  // 아니면 캡처 화면 재진입 (메뉴/툴팁 준비용)
  const selectDelay = useCallback(
    (seconds: number) => {
      if (!session) return
      const sel = currentSelRef.current
      const region = sel ? (toRegionRect(sel) ?? undefined) : undefined
      void window.snaply.invoke('capture:start', { mode, delayMs: seconds * 1000, region })
    },
    [session, mode, toRegionRect]
  )

  const changeMode = useCallback((m: OverlayMode) => {
    setMode(m)
    setPresetRect(null)
    // 다른 디스플레이의 오버레이 창들도 같은 모드로 전환
    void window.snaply.invoke('overlay:setMode', m)
  }, [])

  // 이동 드래그 중계: 로컬 → 절대 좌표로 변환해 메인에 보낸다
  const syncRect = useCallback(
    (rect: Rect, final: boolean) => {
      const current = sessionRef.current
      if (!current) return
      const b = current.displays[0].bounds
      void window.snaply.invoke('overlay:syncRect', {
        rect: { x: rect.x + b.x, y: rect.y + b.y, width: rect.w, height: rect.h },
        final,
        sourceDisplayId: current.displays[0].id
      })
    },
    []
  )

  // 고정 크기 캡처: 배치 모드 시작 — 모든 모니터에서 W×H 사각형이 마우스를 따라다닌다
  const applyPresetSize = useCallback((w: number, h: number) => {
    void window.snaply.invoke('overlay:armPreset', { w, h })
  }, [])

  // 배치 확정(클릭) → 이 창에서 조정 단계로, 다른 창들은 배치 모드 해제
  const placePreset = useCallback((rect: Rect) => {
    setPendingSize(null)
    setPresetRect(rect)
    void window.snaply.invoke('overlay:armPreset', null)
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

  // 지연 캡처 카운트다운: 세션 없이도(화면은 실사용 상태) 배지 + 캡처 예정 영역 포커스만 표시.
  // 이 창은 contentProtection이라 캡처에 찍히지 않고, 클릭은 아래로 통과된다
  if (countdown > 0 || focusRect) {
    return (
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <style>{overlayCss}</style>
        <style>{`@keyframes snaply-focus-pulse {
          0%, 100% { outline-color: var(--primary); outline-offset: 0px; }
          50% { outline-color: var(--overlay-text); outline-offset: 4px; }
        }`}</style>

        {/* 캡처 예정 영역 포커스 테두리 */}
        {focusRect && (
          <div
            data-testid="focus-region"
            style={{
              position: 'absolute',
              left: focusRect.x,
              top: focusRect.y,
              width: focusRect.width,
              height: focusRect.height,
              outline: '3px solid var(--primary)',
              animation: 'snaply-focus-pulse 1s ease-in-out infinite',
              boxShadow: 'inset 0 0 0 1px var(--overlay-glass-border)'
            }}
          />
        )}

        {countdown > 0 && (
          <div
            style={{
              position: 'absolute',
              right: 40,
              bottom: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: '16px 24px',
              borderRadius: 24,
              background: 'var(--overlay-glass)',
              border: '1px solid var(--overlay-glass-border)',
              backdropFilter: 'blur(12px)'
            }}
          >
            <span
              key={countdown}
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: 'var(--overlay-text)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1
              }}
            >
              {countdown}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: 'var(--overlay-text)', fontSize: 'var(--text-body-size)' }}>
                {t('{n}초 후 캡처돼요', { n: countdown })}
              </span>
              <span style={{ color: 'var(--overlay-text-sub)', fontSize: 'var(--text-caption)' }}>
                {t('Space 바로 캡처 · ESC 취소')}
              </span>
            </span>
          </div>
        )}
      </div>
    )
  }

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
          initialRect={presetRect}
          pendingSize={pendingSize}
          onPlacePreset={placePreset}
          onSyncRect={syncRect}
          resetSignal={resetSignal}
          onSelChange={handleSelChange}
          commitLabel={mode === 'scrolling' ? t('⇊ 스크롤 캡처') : undefined}
          idleHint={
            mode === 'scrolling'
              ? t('스크롤 캡처할 영역을 드래그로 선택해 주세요 · 시작하면 자동으로 스크롤돼요 · ESC 취소')
              : undefined
          }
        />
      )}
      {/* 다른 모니터에서 이동 중인 선택 영역 미리보기 (프레임 밝게 + 점선 테두리) */}
      {ghostRect && (mode === 'region' || mode === 'scrolling') && (
        <div
          style={{
            position: 'absolute',
            left: ghostRect.x,
            top: ghostRect.y,
            width: ghostRect.w,
            height: ghostRect.h,
            outline: '2px dashed var(--primary)',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          {frame && (
            <img
              src={frame.dataUrl}
              draggable={false}
              style={{
                position: 'absolute',
                left: -ghostRect.x,
                top: -ghostRect.y,
                width: display.bounds.width,
                height: display.bounds.height
              }}
            />
          )}
        </div>
      )}

      {/* 창 목록은 캡슐이 있는(커서) 디스플레이에만 표시 */}
      {mode === 'window' && showCapsule && <WindowPicker onPick={commitWindow} />}
      {/* 전체 화면: 각 디스플레이 창에 자기 카드 표시 — 클릭한 화면을 캡처 */}
      {mode === 'fullscreen' && <DisplayPicker session={session} onPick={commitFullscreen} />}

      {/* 캡처 모드 캡슐 (커서 디스플레이에만, 드래그/조정 중에는 숨김) */}
      {showCapsule && !interacting && (
        <ModeCapsule
          mode={mode}
          onChange={changeMode}
          onCancel={cancel}
          onDelaySelect={selectDelay}
          onSizeApply={applyPresetSize}
        />
      )}
    </div>
  )
}
