/**
 * 토큰 팔레트 — tokens.css 변수 기반 색상 resolve. 소유자: Editor.
 * 캔버스(Konva)는 CSS 변수를 직접 못 쓰므로 런타임에 computed value를 읽는다.
 */
import type { ColorId } from './types'

/** 색상 id → tokens.css 변수명 (테마와 무관하게 고정된 원색 토큰만 사용) */
export const COLOR_TOKEN: Record<ColorId, string> = {
  blue: '--blue-500',
  red: '--red-500',
  green: '--green-500',
  yellow: '--yellow-500',
  black: '--grey-900',
  white: '--white'
}

export const PALETTE_ORDER: ColorId[] = ['blue', 'red', 'green', 'yellow', 'black', 'white']

/** 배경색 위 텍스트가 잘 보이도록 대비 텍스트 색을 고른다 (순수 로직) */
export function contrastTextColor(bg: ColorId): ColorId {
  return bg === 'yellow' || bg === 'white' ? 'black' : 'white'
}

const cache = new Map<string, string>()

/** CSS 변수 값을 읽는다. 캔버스 렌더 프레임마다 호출되므로 캐시한다. */
export function resolveCssVar(varName: string): string {
  const cached = cache.get(varName)
  if (cached) return cached
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (value) cache.set(varName, value)
  return value || '#000000'
}

/** 팔레트 색상 id → 실제 색상 값 */
export function resolveColor(id: ColorId): string {
  return resolveCssVar(COLOR_TOKEN[id])
}

/** 캔버스 텍스트용 폰트 (tokens.css --font와 동일 계열) */
export const CANVAS_FONT = 'Pretendard, -apple-system, "Segoe UI", "Malgun Gothic", sans-serif'

/** #rrggbb 색상에 알파를 입혀 rgba()로 변환 (그 외 형식은 그대로 반환) */
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(color.trim())
  if (!m) return color
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`
}

/** 캔버스 그림자 색 — --grey-900 토큰에서 resolve (하드코딩 금지) */
export function resolveCanvasShadow(alpha = 0.25): string {
  return withAlpha(resolveCssVar('--grey-900'), alpha)
}
