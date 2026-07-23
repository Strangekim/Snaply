/**
 * 속성 패널 — 선택 객체/활성 도구의 스타일 편집. 소유자: Editor.
 * "같은 종류 모두 바꾸기"는 store.applyStyleToSameType(단일 커밋)을 사용한다.
 */
import type { JSX } from 'react'
import { Button, Segmented, Toggle } from '@ds/index'
import { useI18n } from '../common/i18n'
import styles from './editor.module.css'
import { useEditorStore } from './store'
import { COLOR_TOKEN, PALETTE_ORDER } from './palette'
import { MAGNIFY_SCALES } from './objects'
import { IconReset } from './icons'
import type { AnnoType, BlurMode, SizeLevel, SpotlightShape, ToolId } from './types'

const TOOL_TO_TYPE: Partial<Record<ToolId, AnnoType>> = {
  arrow: 'arrow',
  line: 'line',
  rect: 'rect',
  ellipse: 'ellipse',
  text: 'text',
  callout: 'callout',
  highlighter: 'highlight',
  pen: 'pen',
  step: 'step',
  blur: 'blur',
  spotlight: 'spotlight',
  magnify: 'magnify',
  stamp: 'stamp'
}

const STROKE_TYPES: AnnoType[] = ['arrow', 'line', 'rect', 'ellipse', 'highlight', 'pen']
const FONT_TYPES: AnnoType[] = ['text', 'callout', 'step', 'stamp']
const FILL_TYPES: AnnoType[] = ['rect', 'ellipse']
/** 색상 선택이 의미 없는 종류 (블러/스포트라이트/스탬프는 고정색) */
const NO_COLOR_TYPES: AnnoType[] = ['blur', 'spotlight', 'stamp', 'image', 'frame']

const SIZE_OPTIONS: Array<{ value: SizeLevel; label: string }> = [
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' }
]

// 로케일 변경이 반영되도록 렌더 시점에 t()로 라벨을 만든다
const blurModeOptions = (t: (ko: string) => string): Array<{ value: BlurMode; label: string }> => [
  { value: 'mosaic', label: t('모자이크') },
  { value: 'blur', label: t('블러') }
]

const spotlightOptions = (t: (ko: string) => string): Array<{ value: SpotlightShape; label: string }> => [
  { value: 'rect', label: t('사각형') },
  { value: 'ellipse', label: t('원형') }
]

export function PropertyPanel(): JSX.Element {
  const { t } = useI18n()
  const activeTool = useEditorStore((s) => s.activeTool)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const objects = useEditorStore((s) => s.history.present.objects)
  const stepCounter = useEditorStore((s) => s.history.present.stepCounter)
  const style = useEditorStore((s) => s.style)
  const applyStyle = useEditorStore((s) => s.applyStyle)
  const applyStyleToSameType = useEditorStore((s) => s.applyStyleToSameType)
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
  const showColor =
    targetTypes.size > 0 && [...targetTypes].some((t) => !NO_COLOR_TYPES.includes(t))
  const showStroke = has(STROKE_TYPES)
  const showFont = has(FONT_TYPES)
  const showHead = targetTypes.has('arrow')
  const showFill = has(FILL_TYPES)
  const showBlur = targetTypes.has('blur')
  const showSpotlight = targetTypes.has('spotlight')
  const showMagnify = targetTypes.has('magnify')
  const showStep = activeTool === 'step'
  const sizeOnly = [...targetTypes].every((t) => t === 'step' || t === 'stamp')
  const showBulk = selectedIds.length > 0

  return (
    <div className={styles.propertyPanel}>
      {showColor && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>{t('색상')}</span>
          <div className={styles.swatchRow} role="radiogroup" aria-label={t('색상')}>
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
          <span className={styles.panelLabel}>{t('굵기')}</span>
          <Segmented<SizeLevel>
            size="sm"
            aria-label={t('굵기')}
            options={SIZE_OPTIONS}
            value={style.strokeLevel}
            onChange={(v) => applyStyle({ strokeLevel: v })}
          />
        </div>
      )}

      {showFont && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>{sizeOnly ? t('크기') : t('글자')}</span>
          <Segmented<SizeLevel>
            size="sm"
            aria-label={t('글자')}
            options={SIZE_OPTIONS}
            value={style.fontLevel}
            onChange={(v) => applyStyle({ fontLevel: v })}
          />
        </div>
      )}

      {showHead && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>{t('머리')}</span>
          <Segmented<SizeLevel>
            size="sm"
            aria-label={t('머리')}
            options={SIZE_OPTIONS}
            value={style.headLevel}
            onChange={(v) => applyStyle({ headLevel: v })}
          />
        </div>
      )}

      {showFill && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>{t('채우기')}</span>
          <Toggle
            checked={style.fillEnabled}
            onChange={(v) => applyStyle({ fillEnabled: v })}
            aria-label={t('채우기')}
          />
        </div>
      )}

      {showBlur && (
        <>
          <div className={styles.panelGroup}>
            <span className={styles.panelLabel}>{t('모드')}</span>
            <Segmented<BlurMode>
              size="sm"
              aria-label={t('모드')}
              options={blurModeOptions(t)}
              value={style.blurMode ?? 'mosaic'}
              onChange={(v) => applyStyle({ blurMode: v })}
            />
          </div>
          <div className={styles.panelGroup}>
            <span className={styles.panelLabel}>{t('강도')}</span>
            <Segmented<SizeLevel>
              size="sm"
              aria-label={t('강도')}
              options={SIZE_OPTIONS}
              value={style.blurLevel ?? 'M'}
              onChange={(v) => applyStyle({ blurLevel: v })}
            />
          </div>
        </>
      )}

      {showSpotlight && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>{t('모양')}</span>
          <Segmented<SpotlightShape>
            size="sm"
            aria-label={t('모양')}
            options={spotlightOptions(t)}
            value={style.spotlightShape ?? 'rect'}
            onChange={(v) => applyStyle({ spotlightShape: v })}
          />
        </div>
      )}

      {showMagnify && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>{t('배율')}</span>
          <Segmented
            size="sm"
            aria-label={t('배율')}
            options={MAGNIFY_SCALES.map((v) => ({ value: String(v), label: `${v}x` }))}
            value={String(style.magnifyScale ?? 2)}
            onChange={(v) => applyStyle({ magnifyScale: Number(v) })}
          />
        </div>
      )}

      {showStep && (
        <div className={styles.panelGroup}>
          <span className={styles.panelLabel}>{t('다음 번호')} {stepCounter + 1}</span>
          <Button variant="ghost" size="sm" onClick={resetStepCounter} disabled={stepCounter === 0}>
            <IconReset size={16} />
            &nbsp;{t('번호 초기화')}
          </Button>
        </div>
      )}

      {showBulk && (
        <div className={styles.panelGroup}>
          <Button
            variant="ghost"
            size="sm"
            onClick={applyStyleToSameType}
            title={t('선택한 객체와 같은 종류 전체에 현재 스타일을 적용해요 (undo 한 번으로 되돌릴 수 있어요)')}
          >
            {t('같은 종류 모두 바꾸기')}
          </Button>
        </div>
      )}

      {activeTool === 'crop' && (
        <span className={styles.panelHint}>{t('남길 영역을 드래그해서 지정해 주세요')}</span>
      )}
      {activeTool === 'magnify' && targetTypes.size > 0 && selectedIds.length === 0 && (
        <span className={styles.panelHint}>{t('캔버스를 클릭하면 돋보기가 놓여요')}</span>
      )}
      {!showColor && !showBlur && !showSpotlight && activeTool === 'select' && selectedIds.length === 0 && (
        <span className={styles.panelHint}>{t('객체를 선택하거나 드래그로 여러 개를 선택할 수 있어요')}</span>
      )}
    </div>
  )
}
