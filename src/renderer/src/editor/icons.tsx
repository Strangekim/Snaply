/**
 * 에디터 툴바 아이콘 — 인라인 SVG 자체 제작. 소유자: Editor.
 * currentColor를 사용해 활성/비활성 색이 CSS로 제어된다.
 */
import type { JSX } from 'react'

interface IconProps {
  size?: number
}

const svgProps = (size: number): JSX.IntrinsicElements['svg'] => ({
  width: size,
  height: size,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
})

export function IconSelect({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M5 3l10 7.5-4.4 1L8.4 16 5 3z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconArrow({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 16L15 5" />
      <path d="M9.5 4.5H15.5V10.5" />
    </svg>
  )
}

export function IconLine({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 16L16 4" />
    </svg>
  )
}

export function IconRect({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <rect x="3.5" y="5" width="13" height="10" rx="1.5" />
    </svg>
  )
}

export function IconEllipse({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <ellipse cx="10" cy="10" rx="6.5" ry="5" />
    </svg>
  )
}

export function IconText({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M4.5 5.5V4h11v1.5" />
      <path d="M10 4v12" />
      <path d="M7.5 16h5" />
    </svg>
  )
}

export function IconCallout({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M3.5 5.5A1.5 1.5 0 0 1 5 4h10a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 15 13H9l-3.5 3v-3H5a1.5 1.5 0 0 1-1.5-1.5v-6z" />
    </svg>
  )
}

export function IconHighlighter({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 12.5L11.5 5l3.5 3.5L7.5 16H4v-3.5z" />
      <path d="M10 6.5l3.5 3.5" />
      <path d="M3 18h14" opacity="0.5" strokeWidth="2.4" />
    </svg>
  )
}

export function IconPen({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M3 16.5c2.5-6 5.5-9 7-7.5s-4 6 -2.5 7.5 6-3.5 9.5-5" />
    </svg>
  )
}

export function IconStep({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <circle cx="10" cy="10" r="7" />
      <path d="M8.5 8l2-1.5V14" />
    </svg>
  )
}

export function IconCrop({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M6 2.5V14h11.5" />
      <path d="M2.5 6H14v11.5" />
    </svg>
  )
}

export function IconUndo({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M7.5 4.5L4 8l3.5 3.5" />
      <path d="M4 8h7a5 5 0 0 1 0 10h-1" transform="translate(0,-2)" />
    </svg>
  )
}

export function IconRedo({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M12.5 4.5L16 8l-3.5 3.5" />
      <path d="M16 8H9a5 5 0 0 0 0 10h1" transform="translate(0,-2)" />
    </svg>
  )
}

export function IconCopy({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <rect x="7" y="7" width="9.5" height="9.5" rx="2" />
      <path d="M13 4.5V5h-1.5V3.5H5A1.5 1.5 0 0 0 3.5 5v6.5A1.5 1.5 0 0 0 5 13h.5" />
    </svg>
  )
}

export function IconSave({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M10 3v9" />
      <path d="M6.5 9L10 12.5 13.5 9" />
      <path d="M3.5 13.5V15A1.5 1.5 0 0 0 5 16.5h10a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
    </svg>
  )
}

export function IconReset({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M4.5 8a6 6 0 1 1-.7 4.5" />
      <path d="M4 4v4h4" />
    </svg>
  )
}

export function IconBlur({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="1.5" />
      <path d="M8 3.5v13M12.5 3.5v13M3.5 8h13M3.5 12.5h13" opacity="0.55" />
    </svg>
  )
}

export function IconSpotlight({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <rect x="2.5" y="2.5" width="15" height="15" rx="2" opacity="0.4" />
      <circle cx="10" cy="10" r="4.5" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2" opacity="0.6" />
    </svg>
  )
}

export function IconMagnify({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.8 12.8L17 17" strokeWidth="2" />
      <path d="M6.5 8.5h4M8.5 6.5v4" opacity="0.7" />
    </svg>
  )
}

export function IconStamp({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M7.5 8.5V5a2.5 2.5 0 0 1 5 0v3.5" />
      <path d="M4.5 12.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1.5h-11v-1.5z" />
      <path d="M4 17h12" />
    </svg>
  )
}

export function IconShield({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M10 2.5l6 2.2v4.5c0 4-2.5 6.8-6 8.3-3.5-1.5-6-4.3-6-8.3V4.7l6-2.2z" />
      <path d="M7.5 9.8l1.8 1.8 3.2-3.6" />
    </svg>
  )
}

export function IconSparkle({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6L10 3z" />
      <path d="M15.5 13.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </svg>
  )
}

export function IconTemplate({ size = 20 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <rect x="3" y="3" width="14" height="14" rx="1.5" />
      <path d="M3 7.5h14" />
      <path d="M8.5 7.5V17" />
    </svg>
  )
}
