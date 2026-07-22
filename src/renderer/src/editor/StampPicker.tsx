/**
 * 스탬프 피커 — BottomSheet 그리드. 소유자: Editor.
 * stamps.ts의 정의를 SVG로 미리 보여주고, 선택하면 스탬프 도구가 활성화된다.
 */
import type { JSX } from 'react'
import { BottomSheet } from '@ds/index'
import styles from './editor.module.css'
import { useEditorStore } from './store'
import { STAMP_VIEWBOX, STAMPS, stampSvgColor, type StampElement } from './stamps'

function renderSvgElement(el: StampElement, i: number): JSX.Element {
  switch (el.kind) {
    case 'path':
      return (
        <path
          key={i}
          d={el.d}
          fill={stampSvgColor(el.fill) ?? 'none'}
          stroke={stampSvgColor(el.stroke)}
          strokeWidth={el.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'circle':
      return (
        <circle
          key={i}
          cx={el.cx}
          cy={el.cy}
          r={el.r}
          fill={stampSvgColor(el.fill) ?? 'none'}
          stroke={stampSvgColor(el.stroke)}
          strokeWidth={el.strokeWidth}
        />
      )
    case 'text':
      return (
        <text
          key={i}
          x={el.cx}
          y={el.cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={el.size}
          fontWeight={700}
          fill={stampSvgColor(el.fill)}
        >
          {el.text}
        </text>
      )
  }
}

export function StampPicker(): JSX.Element {
  const open = useEditorStore((s) => s.sheet === 'stamps')
  const setSheet = useEditorStore((s) => s.setSheet)
  const stampKind = useEditorStore((s) => s.stampKind)
  const setStampKind = useEditorStore((s) => s.setStampKind)

  return (
    <BottomSheet open={open} onClose={() => setSheet(null)} title="스탬프">
      <div className={styles.stampGrid}>
        {STAMPS.map((s) => (
          <button
            key={s.kind}
            type="button"
            className={`${styles.stampButton} ${stampKind === s.kind ? styles.stampButtonActive : ''}`}
            title={s.label}
            aria-label={s.label}
            aria-pressed={stampKind === s.kind}
            onClick={() => {
              setStampKind(s.kind)
              setSheet(null)
            }}
          >
            <svg viewBox={`0 0 ${STAMP_VIEWBOX} ${STAMP_VIEWBOX}`} width={36} height={36} aria-hidden>
              {s.elements.map(renderSvgElement)}
            </svg>
          </button>
        ))}
      </div>
      <p className={styles.sheetHint}>스탬프를 고른 뒤 캔버스를 클릭하면 배치돼요</p>
    </BottomSheet>
  )
}
