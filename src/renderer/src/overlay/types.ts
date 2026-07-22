import type { CaptureMode, DisplayInfo } from '@shared/ipc'

/** 프리즈 프레임 (디스플레이별 dataURL) */
export interface FrozenFrame {
  displayId: number
  dataUrl: string
}

/** 오버레이 캡처 세션 상태 */
export interface Session {
  /** 메인에서 넘어온 원래 모드 */
  mode: CaptureMode
  frames: FrozenFrame[]
  displays: DisplayInfo[]
  /** 가상 데스크톱 원점 (모든 디스플레이 bounds의 최소 x/y) — 로컬 좌표 + origin = 절대 좌표 */
  originX: number
  originY: number
}

/** 오버레이 로컬 좌표계 사각형 */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 오버레이에서 실제로 렌더링하는 모드 (all-in-one/scrolling은 region으로 시작) */
export type OverlayMode = 'region' | 'window' | 'fullscreen'

export interface WindowSource {
  sourceId: string
  title: string
  appName?: string
  thumbnailDataUrl: string
}
