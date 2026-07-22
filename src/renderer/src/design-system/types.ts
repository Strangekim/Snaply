/**
 * Snaply 디자인 시스템 — 공용 Props 타입 정의. 소유자: DesignSystem.
 */
import type { ComponentProps, ReactNode } from 'react'

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'lg' | 'md' | 'sm'

export interface ButtonProps extends ComponentProps<'button'> {
  /** 버튼 스타일 변형 (기본: primary) */
  variant?: ButtonVariant
  /** lg=56px, md=48px, sm=36px (기본: md) */
  size?: ButtonSize
  /** 부모 너비 100% 채우기 */
  fullWidth?: boolean
  /** 로딩 스피너 표시 + 클릭 비활성화 */
  loading?: boolean
}

/* -------------------------------------------------------------------- Card */

export type CardPadding = 'md' | 'lg'

export interface CardProps extends ComponentProps<'div'> {
  /** hover 시 배경이 var(--bg-hover)로 변함 */
  hoverable?: boolean
  /** md=20px, lg=24px (기본: md) */
  padding?: CardPadding
}

/* ------------------------------------------------------------- BottomSheet */

export interface BottomSheetProps {
  /** 열림 여부 (닫힘 애니메이션 후 언마운트됨) */
  open: boolean
  /** 딤 클릭·ESC 시 호출 */
  onClose: () => void
  /** 시트 상단 제목 (선택) */
  title?: string
  children: ReactNode
  className?: string
}

export interface SheetItemProps extends Omit<ComponentProps<'button'>, 'title'> {
  /** 좌측 아이콘 슬롯 */
  icon?: ReactNode
  /** 항목 제목 */
  title: ReactNode
  /** 항목 설명 (선택) */
  description?: ReactNode
  /** 항목 강조(선택됨) 표시 */
  selected?: boolean
}

/* ------------------------------------------------------------------- Toast */

export type ToastType = 'success' | 'error' | 'info'

export interface ToastOptions {
  /** 기본: 'success' */
  type?: ToastType
  /** 자동 소멸 시간(ms, 기본: 3000) */
  duration?: number
}

export interface ToastItem {
  id: number
  message: string
  type: ToastType
  leaving: boolean
}

export interface ToastContextValue {
  /** 토스트를 띄워요. 예: toast('링크를 복사했어요') */
  toast: (message: string, options?: ToastOptions) => void
}

export interface ToastProviderProps {
  children: ReactNode
}

/* ------------------------------------------------------------------- Input */

export interface InputProps extends Omit<ComponentProps<'input'>, 'size'> {
  /** 필드 위 라벨 텍스트 */
  label?: string
  /** 에러 메시지 (해요체). 있으면 danger 링 + 메시지 표시 */
  error?: string
  /** 래퍼(컨테이너)에 적용할 클래스 — className은 input 자체에 적용됨 */
  containerClassName?: string
}

/* ------------------------------------------------------------------ Toggle */

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

/* --------------------------------------------------------------- Segmented */

export interface SegmentedOption<T extends string = string> {
  value: T
  label: ReactNode
  /** 라벨 앞 아이콘 슬롯 (선택) */
  icon?: ReactNode
  disabled?: boolean
}

export interface SegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** 부모 너비 100% + 항목 균등 분배 */
  fullWidth?: boolean
  /** md=36px 항목, sm=28px 항목 (기본: md) */
  size?: 'md' | 'sm'
  className?: string
  'aria-label'?: string
}
