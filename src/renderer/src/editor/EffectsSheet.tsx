/**
 * 이미지 효과 패널 — 테두리/그림자/모서리 라운드/찢어진 가장자리. 소유자: Editor.
 * 문서 전체 효과(EditorDoc.effects)를 편집한다. 각 변경은 undo 가능한 커밋.
 */
import type { JSX } from 'react'
import { BottomSheet, Segmented, Toggle } from '@ds/index'
import { useI18n } from '../common/i18n'
import styles from './editor.module.css'
import { useEditorStore } from './store'
import { normalizeEffects } from './effects'
import { COLOR_TOKEN, PALETTE_ORDER } from './palette'

// 로케일 변경이 반영되도록 렌더 시점에 라벨을 만든다
const radiusLevels = (t: (ko: string) => string): Array<{ value: string; label: string; px: number }> => [
  { value: '0', label: t('없음'), px: 0 },
  { value: '8', label: 'S', px: 8 },
  { value: '16', label: 'M', px: 16 },
  { value: '28', label: 'L', px: 28 }
]

const BORDER_WIDTHS: Array<{ value: string; label: string; px: number }> = [
  { value: '2', label: 'S', px: 2 },
  { value: '4', label: 'M', px: 4 },
  { value: '8', label: 'L', px: 8 }
]

const tornSides = (t: (ko: string) => string) =>
  [
    { key: 'top', label: t('위') },
    { key: 'bottom', label: t('아래') },
    { key: 'left', label: t('왼쪽') },
    { key: 'right', label: t('오른쪽') }
  ] as const

export function EffectsSheet(): JSX.Element {
  const { t } = useI18n()
  const open = useEditorStore((s) => s.sheet === 'effects')
  const setSheet = useEditorStore((s) => s.setSheet)
  const rawEffects = useEditorStore((s) => s.history.present.effects)
  const updateEffects = useEditorStore((s) => s.updateEffects)
  const effects = normalizeEffects(rawEffects)

  return (
    <BottomSheet open={open} onClose={() => setSheet(null)} title={t('이미지 효과')}>
      <div className={styles.effectsBody}>
        {/* 테두리 */}
        <div className={styles.effectRow}>
          <span className={styles.effectLabel}>{t('테두리')}</span>
          <Toggle
            checked={effects.border.enabled}
            onChange={(v) => updateEffects({ border: { ...effects.border, enabled: v } })}
            aria-label={t('테두리')}
          />
        </div>
        {effects.border.enabled && (
          <>
            <div className={styles.effectRow}>
              <span className={styles.effectSubLabel}>{t('색상')}</span>
              <div className={styles.swatchRow} role="radiogroup" aria-label={t('테두리')}>
                {PALETTE_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={effects.border.color === id}
                    aria-label={id}
                    className={`${styles.swatch} ${effects.border.color === id ? styles.swatchActive : ''}`}
                    style={{ background: `var(${COLOR_TOKEN[id]})` }}
                    onClick={() => updateEffects({ border: { ...effects.border, color: id } })}
                  />
                ))}
              </div>
            </div>
            <div className={styles.effectRow}>
              <span className={styles.effectSubLabel}>{t('두께')}</span>
              <Segmented
                size="sm"
                aria-label={t('두께')}
                options={BORDER_WIDTHS.map(({ value, label }) => ({ value, label }))}
                value={String(
                  BORDER_WIDTHS.find((b) => b.px === effects.border.width)?.px ?? 4
                )}
                onChange={(v) =>
                  updateEffects({ border: { ...effects.border, width: Number(v) } })
                }
              />
            </div>
          </>
        )}

        {/* 그림자 */}
        <div className={styles.effectRow}>
          <span className={styles.effectLabel}>{t('그림자')}</span>
          <Toggle
            checked={effects.shadow.enabled}
            onChange={(v) => updateEffects({ shadow: { enabled: v } })}
            aria-label={t('그림자')}
          />
        </div>

        {/* 모서리 라운드 */}
        <div className={styles.effectRow}>
          <span className={styles.effectLabel}>{t('모서리 라운드')}</span>
          <Segmented
            size="sm"
            aria-label={t('모서리 라운드')}
            options={radiusLevels(t).map(({ value, label }) => ({ value, label }))}
            value={String(
              radiusLevels(t).find((r) => r.px === effects.cornerRadius)?.px ?? 0
            )}
            onChange={(v) => updateEffects({ cornerRadius: Number(v) })}
          />
        </div>

        {/* 찢어진 가장자리 */}
        <div className={styles.effectRow}>
          <span className={styles.effectLabel}>{t('찢어진 가장자리')}</span>
          <div className={styles.tornToggles}>
            {tornSides(t).map(({ key, label }) => (
              <label key={key} className={styles.tornToggle}>
                <span>{label}</span>
                <Toggle
                  checked={effects.torn[key]}
                  onChange={(v) => updateEffects({ torn: { ...effects.torn, [key]: v } })}
                  aria-label={`찢어진 가장자리 ${label}`}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}
