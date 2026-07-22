/**
 * 배경 이미지 컨텍스트 — 블러/돋보기 노드가 배경을 샘플링할 수 있게 전달. 소유자: Editor.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import type { RectArea } from './types'

export interface BackgroundInfo {
  image: HTMLImageElement | null
  crop: RectArea | null
  docWidth: number
  docHeight: number
}

export const BackgroundContext = createContext<BackgroundInfo>({
  image: null,
  crop: null,
  docWidth: 0,
  docHeight: 0
})

export function useBackground(): BackgroundInfo {
  return useContext(BackgroundContext)
}

const imageCache = new Map<string, HTMLImageElement>()

/** dataURL → HTMLImageElement (모듈 캐시 — 같은 src 재사용) */
export function useHtmlImage(src: string | null): HTMLImageElement | null {
  const cached = src ? (imageCache.get(src) ?? null) : null
  const [img, setImg] = useState<HTMLImageElement | null>(cached)

  useEffect(() => {
    if (!src) {
      setImg(null)
      return
    }
    const hit = imageCache.get(src)
    if (hit) {
      setImg(hit)
      return
    }
    const el = new window.Image()
    let alive = true
    el.onload = () => {
      imageCache.set(src, el)
      if (alive) setImg(el)
    }
    el.src = src
    return () => {
      alive = false
      el.onload = null
    }
  }, [src])

  return src ? (img?.src === src ? img : (imageCache.get(src) ?? null)) : null
}
