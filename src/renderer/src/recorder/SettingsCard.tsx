/** 녹화 설정 카드 (시작 전 상태). 소유자: Recorder */
import type { JSX } from 'react'
import { Button, Card, Segmented, Toggle } from '@ds/index'
import { useI18n } from '../common/i18n'
import type { DisplayInfo } from '@shared/ipc'
import type { GifFps, RecordForm } from './types'
import { IconCamera, IconClose, IconMic, IconSpeaker } from './icons'
import styles from './recorder.module.css'

interface SettingsCardProps {
  displays: DisplayInfo[]
  form: RecordForm
  onChange: (patch: Partial<RecordForm>) => void
  onStart: () => void
  starting: boolean
}

export function SettingsCard({
  displays,
  form,
  onChange,
  onStart,
  starting
}: SettingsCardProps): JSX.Element {
  const { t } = useI18n()
  const displayValue = String(form.displayId ?? displays.find((d) => d.isPrimary)?.id ?? '')

  return (
    <div className={styles.panelRoot}>
      <Card padding="lg" className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.cardTitle}>{t('화면 녹화')}</h1>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="닫기"
            onClick={() => void window.snaply.invoke('window:close', undefined)}
          >
            <IconClose />
          </button>
        </div>

        <div className={styles.field}>
          <div className={styles.fieldLabel}>{t('녹화 대상')}</div>
          <Segmented<RecordForm['target']>
            aria-label="녹화 대상"
            fullWidth
            value={form.target}
            onChange={(target) => onChange({ target })}
            options={[
              { value: 'fullscreen', label: t('전체 화면') },
              { value: 'region', label: t('영역') }
            ]}
          />
        </div>

        {displays.length > 1 && (
          <div className={styles.field}>
            <div className={styles.fieldLabel}>{t('디스플레이')}</div>
            <Segmented
              aria-label="디스플레이 선택"
              fullWidth
              size="sm"
              value={displayValue}
              onChange={(v) => onChange({ displayId: Number(v) })}
              options={displays.map((d, i) => ({
                value: String(d.id),
                label: d.isPrimary ? `${i + 1} (주)` : String(i + 1)
              }))}
            />
          </div>
        )}

        <div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>
              <IconMic />
              {t('마이크')}
</span>
            <Toggle aria-label="마이크" checked={form.mic} onChange={(mic) => onChange({ mic })} />
          </div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>
              <IconSpeaker />
              {t('시스템 오디오')}
</span>
            <Toggle
              aria-label="시스템 오디오"
              checked={form.systemAudio}
              onChange={(systemAudio) => onChange({ systemAudio })}
            />
          </div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>
              <IconCamera />
              {t('웹캠')}
</span>
            <Toggle
              aria-label="웹캠"
              checked={form.webcam}
              onChange={(webcam) => onChange({ webcam })}
            />
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.fieldLabel}>{t('포맷')}</div>
          <Segmented<RecordForm['format']>
            aria-label="저장 포맷"
            fullWidth
            value={form.format}
            onChange={(format) => onChange({ format })}
            options={[
              { value: 'mp4', label: 'MP4' },
              { value: 'gif', label: 'GIF' }
            ]}
          />
        </div>

        {form.format === 'gif' && (
          <div className={styles.field}>
            <div className={styles.fieldLabel}>{t('GIF 프레임레이트')}</div>
            <Segmented<GifFps>
              aria-label="GIF 프레임레이트"
              fullWidth
              size="sm"
              value={form.fps}
              onChange={(fps) => onChange({ fps })}
              options={[
                { value: '10', label: '10fps' },
                { value: '15', label: '15fps' },
                { value: '24', label: '24fps' }
              ]}
            />
          </div>
        )}

        <div className={styles.startArea}>
          <Button size="lg" fullWidth loading={starting} onClick={onStart}>
            {form.target === 'region' ? t('영역 선택하고 시작') : t('녹화 시작')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
