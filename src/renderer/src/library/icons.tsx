/** 보관함 전용 인라인 아이콘 (currentColor 기반). 소유자: Library. */
import type { JSX } from 'react'

interface IconProps {
  size?: number
  filled?: boolean
}

function svgProps(size: number): { width: number; height: number; viewBox: string; 'aria-hidden': true } {
  return { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true }
}

export function StarIcon({ size = 16, filled = false }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9L12 3.5z" />
    </svg>
  )
}

export function PinIcon({ size = 16, filled = false }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M9 4h6l-1 6 3 3v1H7v-1l3-3-1-6z" />
      <path d="M12 14v6" />
    </svg>
  )
}

export function EditIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l4-.8L20.2 7 17 3.8 4.8 16 4 20z" />
    </svg>
  )
}

export function CopyIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  )
}

export function FolderIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  )
}

export function TrashIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  )
}

export function OpenFolderIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1H7l-2.5 8H5a2 2 0 0 1-2-2V7z" />
      <path d="M7 10h15l-2.6 8H4.4" />
    </svg>
  )
}

export function SettingsIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.07-.4.1-.8.1-1.2z" />
    </svg>
  )
}

export function SearchIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  )
}

export function GridIcon({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function TimelineIcon({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 6h14M5 12h14M5 18h14" />
      <circle cx="5" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PlusIcon({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function TextScanIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M8.5 9.5V8.5h7v1M12 8.5V16M10.5 16h3" />
    </svg>
  )
}

export function PlayIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="currentColor" stroke="none">
      <path d="M8.5 5.8a1 1 0 0 1 1.5-.86l9 5.2a1 1 0 0 1 0 1.72l-9 5.2a1 1 0 0 1-1.5-.86V5.8z" />
    </svg>
  )
}

export function CheckIcon({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function FilmIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M7.5 5v14M16.5 5v14M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4" />
    </svg>
  )
}

export function CameraIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  )
}
