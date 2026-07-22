/**
 * 속성 패널 — 선택 객체/활성 도구의 스타일 편집. 소유자: Editor.
 * 일괄 스타일 변경(Phase 3)은 store.updateObjects + applyStylePatch를 재사용하면 된다.
 */
import type { JSX } from 'react'
import { Button, Segmented, Toggle } from '@ds/index'
import styles from './editor.module.css'
import { useEditorStore } from './store'
import { COLOR_TOKEN, PALETTE_ORDER } from './palette'
import { IconReset } from './icons'
import type { AnnoType, SizeLevel, ToolId } from './types'

const TOOL_TO_TYPE: Partial<Record<ToolId, AnnoType>> = {
  arrow: 'arrow',
  line: 'line',
  rect: 'rect',
  ellipse: 'ellipse',
  text: 'text',
  callout: 'callout',
  highlighter: 'highlight',
  pen: 'pen',
  step: 'step'
}

const STROKE_TYPES: AnnoType[] = ['arrow', 'line', 'rect', 'ellipse', 'highlight', 'pen']
const FONT_TYPES: AnnoType[] = ['text', 'callout', 'step']
const FILL_TYPES: AnnoType[] = ['rect', 'ellipse']

const SIZE_OPTIONS: Array<{ value: SizeLevel; label: string }> = [
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' }
]

export function PropertyPanel(): JSX.Element {
  const activeTool = useEditorStore((s) => s.activeTool)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const objects = useEditorStore((s) => s.history.present.objects)
  const stepCounter = useEditorStore((s) => s.history.present.stepCounter)
  const style = useEditorStore((s) => s.style)
  const applyStyle = useEditorStore((s) => s.applyStyle)
  const resetStepCounter = useEditorStore((s) => s.resetStepCounter)

  // 대상 객체 종류: 선택이 있으면 선택 기준, 없으면 활성 도구 기준
  const targetTypes = new Set<AnnoType>()
  if (selectedIds.length > 0) {
    const idSet = new Set(selectedIds)
    for (const o of objects) if (idSet.has(o.id)) targetTypes.add(o.type)
  } else {
    const t = TOOL_TO_TYPE[activeTool]
    if (t) targetTypes.add(t)
  }

  const has = (types: AnnoType[]): boolean => types.some((t) => targetTypes.has(t))
  const showColor = targetTypes.size > 0
  const showStroke = has(STROKE_TYPES)
  const showFont = has(FONT_TYPES)
  const showHead = targetTypes.has('arrow')
  const showFill = has(FILL_TYPES)
  const showStep = activeTool === 'step'

  return (
    <div className={styles.propertyPanel}>
      {showColor && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>색상</span>
          <div className={styles.swatchRow} role="radiogroup" aria-label="색상">
            {PALETTE_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={style.color === id}
                aria-label={id}
                className={`${styles.swatch} ${style.color === id ? styles.swatchActive : ''}`}
                style={{ background: `var(${COLOR_TOKEN[id]})` }}
                onClick={() => applyStyle({ color: id })}
              />
            ))}
          </div>
        </div>
      )}

      {showStroke && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>굵기</span>
          <Segmented<SizeLevel>
            size="sm"
            aria-label="굵기"
            options={SIZE_OPTIONS}
            value={style.strokeLevel}
            onChange={(v) => applyStyle({ strokeLevel: v })}
          />
        </div>
      )}

      {showFont && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>{targetTypes.has('step') && targetTypes.size === 1 ? '크기' : '글자'}</span>
          <Segmented<SizeLevel>
            size="sm"
            aria-label="글자 크기"
            options={SIZE_OPTIONS}
            value={style.fontLevel}
            onChange={(v) => applyStyle({ fontLevel: v })}
          />
        </div>
      )}

      {showHead && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>머리</span>
          <Segmented<SizeLevel>
            size="sm"
            aria-label="화살표 머리 크기"
            options={SIZE_OPTIONS}
            value={style.headLevel}
            onChange={(v) => applyStyle({ headLevel: v })}
          />
        </div>
      )}

      {showFill && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>채우기</span>
          <Toggle
            checked={style.fillEnabled}
            onChange={(v) => applyStyle({ fillEnabled: v })}
            aria-label="채우기"
          />
        </div>
      )}

      {showStep && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>다음 번호 {stepCounter + 1}</span>
          <Button variant="ghost" size="sm" onClick={resetStepCounter} disabled={stepCounter === 0}>
            <IconReset size={16} />
            &nbsp;번호 초기화
          </Button>
        </div>
      )}

      {activeTool === 'crop' && (
        <span className={styles.panelHint}>남길 영역을 드래그해서 지정해 주세요</span>
      )}
      {!showColor && activeTool === 'select' && (
        <span className={styles.panelHint}>객체를 선택하면 스타일을 바꿀 수 있어요</span>
      )}
    </div>
  )
}
