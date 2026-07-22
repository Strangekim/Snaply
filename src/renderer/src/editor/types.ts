/**
 * Snaply 에디터 — 문서 모델 타입. 소유자: Editor.
 * 모든 주석 객체는 직렬화 가능한 plain object (Konva 노드 참조 없음).
 */

export type ToolId =
  | 'select'
  | 'arrow'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'callout'
  | 'highlighter'
  | 'pen'
  | 'step'
  | 'blur'
  | 'spotlight'
  | 'magnify'
  | 'stamp'
  | 'crop'

/** 토큰 팔레트 색상 id — 실제 값은 tokens.css 변수에서 resolve */
export type ColorId = 'blue' | 'red' | 'green' | 'yellow' | 'black' | 'white'

export type SizeLevel = 'S' | 'M' | 'L'

export interface Point {
  x: number
  y: number
}

export interface RectArea {
  x: number
  y: number
  width: number
  height: number
}

interface ObjBase {
  id: string
  x: number
  y: number
  rotation: number
  color: ColorId
}

export interface ArrowObj extends ObjBase {
  type: 'arrow'
  /** [x1, y1, x2, y2] — 객체 원점 기준 상대 좌표 */
  points: number[]
  strokeWidth: number
  /** 화살표 머리 크기(px) */
  headSize: number
}

export interface LineObj extends ObjBase {
  type: 'line'
  points: number[]
  strokeWidth: number
}

export interface RectObj extends ObjBase {
  type: 'rect'
  width: number
  height: number
  strokeWidth: number
  fillEnabled: boolean
}

export interface EllipseObj extends ObjBase {
  type: 'ellipse'
  width: number
  height: number
  strokeWidth: number
  fillEnabled: boolean
}

export interface TextObj extends ObjBase {
  type: 'text'
  text: string
  fontSize: number
}

export interface CalloutObj extends ObjBase {
  type: 'callout'
  width: number
  height: number
  text: string
  fontSize: number
  /** 말풍선 꼬리 끝점 — 객체 원점 기준 상대 좌표 */
  tailX: number
  tailY: number
}

export interface HighlightObj extends ObjBase {
  type: 'highlight'
  points: number[]
  strokeWidth: number
}

export interface PenObj extends ObjBase {
  type: 'pen'
  points: number[]
  strokeWidth: number
}

export interface StepObj extends ObjBase {
  type: 'step'
  /** 표시 숫자 (1부터) */
  value: number
  radius: number
}

// ───────────── Phase 3 객체 ─────────────

export type BlurMode = 'blur' | 'mosaic'

/** 배경 이미지의 사각 영역을 블러/모자이크 처리 */
export interface BlurObj extends ObjBase {
  type: 'blur'
  width: number
  height: number
  mode: BlurMode
  /** 강도(px) — blur는 blur 반경, mosaic은 intensity*2가 블록 크기 */
  intensity: number
}

export type SpotlightShape = 'rect' | 'ellipse'

/** 영역 밖을 어둡게 하는 스포트라이트 (딤은 문서당 한 번만 렌더) */
export interface SpotlightObj extends ObjBase {
  type: 'spotlight'
  width: number
  height: number
  shape: SpotlightShape
}

/** 배경 이미지를 확대해 보여주는 원형 돋보기 렌즈 — x,y가 중심 */
export interface MagnifyObj extends ObjBase {
  type: 'magnify'
  radius: number
  /** 확대 배율 (2~4) */
  scale: number
}

export type StampKind =
  | 'check'
  | 'cross'
  | 'cursor'
  | 'question'
  | 'exclamation'
  | 'star'
  | 'heart'
  | 'badge-1'
  | 'badge-2'
  | 'badge-3'
  | 'face-smile'
  | 'face-neutral'
  | 'face-frown'

/** SVG 스탬프 — x,y가 중심, size는 렌더 한 변 길이(px) */
export interface StampObj extends ObjBase {
  type: 'stamp'
  kind: StampKind
  size: number
}

/** 붙여넣은 이미지 (dataURL) */
export interface ImageObj extends ObjBase {
  type: 'image'
  width: number
  height: number
  src: string
}

/** 템플릿 가이드 프레임 — 이미지를 붙여넣을 자리 표시 */
export interface FrameObj extends ObjBase {
  type: 'frame'
  width: number
  height: number
  label: string
}

export type AnnoObject =
  | ArrowObj
  | LineObj
  | RectObj
  | EllipseObj
  | TextObj
  | CalloutObj
  | HighlightObj
  | PenObj
  | StepObj
  | BlurObj
  | SpotlightObj
  | MagnifyObj
  | StampObj
  | ImageObj
  | FrameObj

export type AnnoType = AnnoObject['type']

/** 문서 전체 이미지 효과 (Phase 3) */
export interface ImageEffects {
  border: { enabled: boolean; color: ColorId; width: number }
  shadow: { enabled: boolean }
  /** 모서리 라운드 반경(px). 0이면 없음 */
  cornerRadius: number
  /** 찢어진 가장자리 — 방향별 선택 */
  torn: { top: boolean; bottom: boolean; left: boolean; right: boolean }
}

/** 히스토리에 스냅샷으로 저장되는 문서 상태 */
export interface EditorDoc {
  objects: AnnoObject[]
  /** 원본 이미지 좌표계 기준 적용된 크롭 영역 (null이면 크롭 없음) */
  crop: RectArea | null
  /** 스텝 넘버 카운터 — 다음 생성 값은 stepCounter + 1 */
  stepCounter: number
  /** 문서 전체 효과 — 미지정이면 효과 없음 (기존 문서 호환) */
  effects?: ImageEffects
}

/** 새 객체 생성 시 사용할 기본 스타일 (속성 패널과 연동) */
export interface StyleSettings {
  color: ColorId
  strokeLevel: SizeLevel
  fontLevel: SizeLevel
  headLevel: SizeLevel
  fillEnabled: boolean
  /** Phase 3 — 선택적(기존 API 호환): 블러/스포트라이트/돋보기 기본값 */
  blurMode?: BlurMode
  blurLevel?: SizeLevel
  spotlightShape?: SpotlightShape
  magnifyScale?: number
}
