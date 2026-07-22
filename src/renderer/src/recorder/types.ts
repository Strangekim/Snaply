/** Recorder 렌더러 내부 타입. 소유자: Recorder */

export type GifFps = '10' | '15' | '24'

/** 설정 카드 폼 상태 */
export interface RecordForm {
  target: 'fullscreen' | 'region'
  /** 미지정이면 주 디스플레이 */
  displayId?: number
  mic: boolean
  systemAudio: boolean
  webcam: boolean
  format: 'mp4' | 'gif'
  fps: GifFps
}

/** 렌더러 로컬 페이즈 — 계약 밖 세부 상태(select/preview 등) 포함 */
export type Phase =
  | 'card'
  | 'select'
  | 'countdown'
  | 'recording'
  | 'paused'
  | 'preview'
  | 'saving'
  | 'done'
