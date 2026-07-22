/**
 * 블러/모자이크 영역 렌더 — 배경 이미지의 해당 영역을 오프스크린 캔버스로 가공. 소유자: Editor.
 */
import type { BlurMode, RectArea } from './types'

/** 모자이크 블록 크기(px) = intensity * 2 */
export function mosaicBlockSize(intensity: number): number {
  return Math.max(2, Math.round(intensity * 2))
}

/**
 * 배경 이미지에서 region(문서 좌표)을 잘라 블러/모자이크 처리한 캔버스를 만든다.
 * crop이 있으면 문서 좌표 = 원본 이미지 좌표 - crop 오프셋.
 */
export function renderRegionCanvas(
  image: HTMLImageElement,
  crop: RectArea | null,
  region: RectArea,
  mode: BlurMode,
  intensity: number
): HTMLCanvasElement | null {
  const w = Math.max(1, Math.round(region.width))
  const h = Math.max(1, Math.round(region.height))
  const sx = region.x + (crop?.x ?? 0)
  const sy = region.y + (crop?.y ?? 0)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (mode === 'mosaic') {
    const block = mosaicBlockSize(intensity)
    const tw = Math.max(1, Math.ceil(w / block))
    const th = Math.max(1, Math.ceil(h / block))
    const temp = document.createElement('canvas')
    temp.width = tw
    temp.height = th
    const tctx = temp.getContext('2d')
    if (!tctx) return null
    // 다운샘플
    tctx.imageSmoothingEnabled = true
    tctx.drawImage(image, sx, sy, w, h, 0, 0, tw, th)
    // 업샘플 (픽셀화)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(temp, 0, 0, tw, th, 0, 0, w, h)
    return canvas
  }

  // blur — 경계 알파 번짐 방지를 위해 원본을 먼저 깔고, 여유(pad)를 두고 블러를 덮는다
  const pad = intensity * 2
  ctx.drawImage(image, sx, sy, w, h, 0, 0, w, h)
  ctx.filter = `blur(${intensity}px)`
  ctx.drawImage(image, sx - pad, sy - pad, w + pad * 2, h + pad * 2, -pad, -pad, w + pad * 2, h + pad * 2)
  ctx.filter = 'none'
  return canvas
}
