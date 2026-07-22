import { useEffect, useRef, useState } from 'react'
import { glassCard } from './glass'
import type { Session } from './types'

const SRC = 15 // 프리즈 프레임에서 읽어올 소스 영역 (px)
const ZOOM = 8 // 확대 배율
const CANVAS = SRC * ZOOM // 120
const CARD_W = CANVAS + 12
const CARD_H = CANVAS + 40
const OFFSET = 22 // 마우스로부터의 간격

interface MagnifierProps {
  session: Session
  /** 오버레이 로컬 좌표 */
  mouse: { x: number; y: number }
}

/** 마우스 주변 픽셀을 8배 확대해서 보여주는 돋보기 카드 (마우스 오른쪽-아래를 따라다님) */
export function Magnifier({ session, mouse }: MagnifierProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map())
  const [, setLoadedTick] = useState(0)

  // 프리즈 프레임 dataURL → 이미지 디코딩 (세션당 1회)
  useEffect(() => {
    const map = new Map<number, HTMLImageElement>()
    for (const frame of session.frames) {
      const img = new Image()
      img.onload = () => setLoadedTick((t) => t + 1)
      img.src = frame.dataUrl
      map.set(frame.displayId, img)
    }
    imagesRef.current = map
  }, [session])

  // 절대 좌표 및 대상 디스플레이 계산
  const gx = Math.round(mouse.x + session.originX)
  const gy = Math.round(mouse.y + session.originY)
  const display =
    session.displays.find(
      (d) => gx >= d.bounds.x && gx < d.bounds.x + d.bounds.width && gy >= d.bounds.y && gy < d.bounds.y + d.bounds.height
    ) ?? session.displays[0]

  // 픽셀 확대 렌더링
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, CANVAS, CANVAS)
    const img = imagesRef.current.get(display.id)
    if (!img || !img.complete || img.naturalWidth === 0) return
    const scaleX = img.naturalWidth / display.bounds.width
    const scaleY = img.naturalHeight / display.bounds.height
    const px = (gx - display.bounds.x) * scaleX
    const py = (gy - display.bounds.y) * scaleY
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, px - SRC / 2, py - SRC / 2, SRC, SRC, 0, 0, CANVAS, CANVAS)
  })

  // 화면 경계에 닿으면 반대쪽으로 뒤집기
  let left = mouse.x + OFFSET
  let top = mouse.y + OFFSET
  if (left + CARD_W > window.innerWidth - 8) left = mouse.x - OFFSET - CARD_W
  if (top + CARD_H > window.innerHeight - 8) top = mouse.y - OFFSET - CARD_H

  return (
    <div
      style={{
        ...glassCard,
        position: 'absolute',
        left,
        top,
        width: CARD_W,
        padding: 5,
        pointerEvents: 'none',
        zIndex: 30
      }}
    >
      <div style={{ position: 'relative', width: CANVAS, height: CANVAS, borderRadius: 12, overflow: 'hidden' }}>
        <canvas ref={canvasRef} width={CANVAS} height={CANVAS} style={{ display: 'block' }} />
        {/* 십자 가이드 라인 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: CANVAS / 2,
            width: CANVAS,
            height: 1,
            background: 'var(--overlay-glass-border)',
            pointerEvents: 'none'
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: CANVAS / 2,
            top: 0,
            width: 1,
            height: CANVAS,
            background: 'var(--overlay-glass-border)',
            pointerEvents: 'none'
          }}
        />
        {/* 중앙(현재) 픽셀 하이라이트 */}
        <div
          style={{
            position: 'absolute',
            left: CANVAS / 2 - ZOOM / 2,
            top: CANVAS / 2 - ZOOM / 2,
            width: ZOOM,
            height: ZOOM,
            outline: '1.5px solid var(--primary)',
            pointerEvents: 'none'
          }}
        />
      </div>
      <div
        style={{
          textAlign: 'center',
          fontSize: 'var(--text-caption)',
          color: 'var(--overlay-text-sub)',
          padding: '6px 0 2px',
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        X {gx} · Y {gy}
      </div>
    </div>
  )
}
