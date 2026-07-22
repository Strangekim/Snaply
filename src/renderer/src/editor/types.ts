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

export type AnnoType = AnnoObject['type']

/** 히스토리에 스냅샷으로 저장되는 문서 상태 */
export interface EditorDoc {
  objects: AnnoObject[]
  /** 원본 이미지 좌표계 기준 적용된 크롭 영역 (null이면 크롭 없음) */
  crop: RectArea | null
  /** 스텝 넘버 카운터 — 다음 생성 값은 stepCounter + 1 */
  stepCounter: number
}

/** 새 객체 생성 시 사용할 기본 스타일 (속성 패널과 연동) */
export interface StyleSettings {
  color: ColorId
  strokeLevel: SizeLevel
  fontLevel: SizeLevel
  headLevel: SizeLevel
  fillEnabled: boolean
}
