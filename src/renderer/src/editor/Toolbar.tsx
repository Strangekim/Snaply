/**
 * 좌측 세로 툴바. 소유자: Editor.
 */
import type { JSX, ReactNode } from 'react'
import styles from './editor.module.css'
import { useEditorStore } from './store'
import type { ToolId } from './types'
import {
  IconArrow,
  IconBlur,
  IconCallout,
  IconCrop,
  IconEllipse,
  IconHighlighter,
  IconLine,
  IconMagnify,
  IconPen,
  IconRect,
  IconSelect,
  IconSpotlight,
  IconStamp,
  IconStep,
  IconText
} from './icons'

interface ToolDef {
  id: ToolId
  label: string
  shortcut?: string
  icon: ReactNode
}

export const TOOLS: ToolDef[] = [
  { id: 'select', label: '선택', shortcut: 'V', icon: <IconSelect /> },
  { id: 'arrow', label: '화살표', shortcut: 'A', icon: <IconArrow /> },
  { id: 'line', label: '선', shortcut: 'L', icon: <IconLine /> },
  { id: 'rect', label: '사각형', shortcut: 'R', icon: <IconRect /> },
  { id: 'ellipse', label: '원', shortcut: 'O', icon: <IconEllipse /> },
  { id: 'text', label: '텍스트', shortcut: 'T', icon: <IconText /> },
  { id: 'callout', label: '말풍선', icon: <IconCallout /> },
  { id: 'highlighter', label: '형광펜', icon: <IconHighlighter /> },
  { id: 'pen', label: '펜', icon: <IconPen /> },
  { id: 'step', label: '스텝 넘버', icon: <IconStep /> },
  { id: 'blur', label: '블러 · 모자이크', icon: <IconBlur /> },
  { id: 'spotlight', label: '스포트라이트', icon: <IconSpotlight /> },
  { id: 'magnify', label: '돋보기', icon: <IconMagnify /> },
  { id: 'stamp', label: '스탬프', icon: <IconStamp /> },
  { id: 'crop', label: '자르기', icon: <IconCrop /> }
]

export function Toolbar(): JSX.Element {
  const activeTool = useEditorStore((s) => s.activeTool)
  const setTool = useEditorStore((s) => s.setTool)
  const setSheet = useEditorStore((s) => s.setSheet)

  const handleClick = (id: ToolId): void => {
    setTool(id)
    // 스탬프 도구는 피커를 함께 연다
    if (id === 'stamp') setSheet('stamps')
  }

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="편집 도구">
      {TOOLS.map((tool, i) => (
        <span key={tool.id} style={{ display: 'contents' }}>
          {(i === 1 || i === TOOLS.length - 1) && <div className={styles.toolbarDivider} />}
          <button
            type="button"
            className={`${styles.toolButton} ${activeTool === tool.id ? styles.toolButtonActive : ''}`}
            title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
            aria-label={tool.label}
            aria-pressed={activeTool === tool.id}
            onClick={() => handleClick(tool.id)}
          >
            {tool.icon}
          </button>
        </span>
      ))}
    </div>
  )
}
