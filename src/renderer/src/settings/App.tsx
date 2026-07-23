/** Snaply 설정 화면. 소유자: Architect (Phase 4). */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { Card, Input, Segmented, Toggle, ToastProvider, useToast } from '@ds/index'
import { useTheme } from '../common/useTheme'
import { translate } from '../common/i18n'
import { formatFilename } from '@shared/filename'
import type { AppSettings, HotkeySettings } from '@shared/ipc'
import { HotkeyField } from './HotkeyField'
import { STRINGS, type Locale } from './strings'

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section style={{ marginTop: 'var(--space-8)' }}>
      <h2
        style={{
          fontSize: 'var(--text-section)',
          fontWeight: 600,
          color: 'var(--text-title)',
          margin: '0 0 var(--space-3)'
        }}
      >
        {title}
      </h2>
      <Card>{children}</Card>
    </section>
  )
}

function Divider(): JSX.Element {
  return <div style={{ height: 1, background: 'var(--border-divider)', margin: 'var(--space-3) 0' }} />
}

function SettingsScreen(): JSX.Element {
  const { toast } = useToast()
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    void window.snaply.invoke('settings:get', undefined).then(setSettings)
    return window.snaply.on('event:settingsChanged', setSettings)
  }, [])

  const patch = useCallback(
    (p: Partial<AppSettings>) => {
      void window.snaply.invoke('settings:set', p).then((next) => {
        setSettings(next)
        toast(STRINGS[next.language].saved, { type: 'success' })
      })
    },
    [toast]
  )

  const patchHotkey = useCallback(
    (key: keyof HotkeySettings, accelerator: string) => {
      if (!settings) return
      patch({ hotkeys: { ...settings.hotkeys, [key]: accelerator } })
    },
    [settings, patch]
  )

  const [patternDraft, setPatternDraft] = useState<string | null>(null)
  const previewName = useMemo(
    () => formatFilename(patternDraft ?? settings?.filenamePattern ?? '', new Date()),
    [patternDraft, settings?.filenamePattern]
  )

  if (!settings) {
    return <div style={{ padding: 'var(--space-8)', color: 'var(--text-sub)' }}>{translate('불러오는 중이에요...')}</div>
  }

  const t = STRINGS[settings.language as Locale] ?? STRINGS.ko
  const hotkeyEntries: Array<{ key: keyof HotkeySettings; label: string }> = [
    { key: 'allInOne', label: t.hkAllInOne },
    { key: 'region', label: t.hkRegion },
    { key: 'fullscreen', label: t.hkFullscreen },
    { key: 'window', label: t.hkWindow },
    { key: 'record', label: t.hkRecord }
  ]

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 640, margin: '0 auto', userSelect: 'none' }}>
      <h1 style={{ fontSize: 'var(--text-h2)', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
        {t.title}
      </h1>

      <Section title={t.sectionHotkeys}>
        {hotkeyEntries.map(({ key, label }, i) => (
          <div key={key}>
            {i > 0 && <Divider />}
            <HotkeyField
              label={label}
              value={settings.hotkeys[key]}
              otherValues={hotkeyEntries.filter((e) => e.key !== key).map((e) => settings.hotkeys[e.key])}
              onChange={(acc) => patchHotkey(key, acc)}
            />
          </div>
        ))}
      </Section>

      <Section title={t.sectionSave}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 48 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text-body)' }}>{t.savePath}</div>
            <div
              style={{
                color: 'var(--text-sub)',
                fontSize: 'var(--text-caption)',
                marginTop: 'var(--space-1)',
                wordBreak: 'break-all'
              }}
            >
              {settings.savePath}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void window.snaply
                .invoke('dialog:pickFolder', { title: t.savePath, defaultPath: settings.savePath })
                .then((dir) => {
                  if (dir) patch({ savePath: dir })
                })
            }}
            style={{
              height: 40,
              padding: '0 var(--space-4)',
              borderRadius: 'var(--radius-button)',
              border: 'none',
              background: 'var(--primary-bg)',
              color: 'var(--primary)',
              fontFamily: 'var(--font)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform var(--transition-fast)'
            }}
          >
            {t.changeFolder}
          </button>
        </div>
        <Divider />
        <Input
          label={t.filenamePattern}
          value={patternDraft ?? settings.filenamePattern}
          onChange={(e) => setPatternDraft(e.target.value)}
          onBlur={() => {
            if (patternDraft != null && patternDraft !== settings.filenamePattern) {
              patch({ filenamePattern: patternDraft })
            }
            setPatternDraft(null)
          }}
        />
        <div style={{ color: 'var(--text-sub)', fontSize: 'var(--text-caption)', marginTop: 'var(--space-2)' }}>
          {t.filenameHint} · {t.preview}: {previewName}.png
        </div>
      </Section>

      <Section title={t.sectionCapture}>
        <div style={{ color: 'var(--text-body)', marginBottom: 'var(--space-3)' }}>{t.afterCapture}</div>
        <Segmented
          fullWidth
          options={[
            { value: 'editor', label: t.afterEditor },
            { value: 'clipboard', label: t.afterClipboard },
            { value: 'quick-annotate', label: t.afterQuick }
          ]}
          value={settings.afterCapture}
          onChange={(v) => patch({ afterCapture: v })}
        />
      </Section>

      <Section title={t.sectionApp}>
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 48 }}>
          <div style={{ flex: 1, color: 'var(--text-body)' }}>{t.language}</div>
          <Segmented
            options={[
              { value: 'ko' as Locale, label: '한국어' },
              { value: 'en' as Locale, label: 'English' }
            ]}
            value={settings.language}
            onChange={(v) => patch({ language: v })}
            size="sm"
          />
        </div>
        <Divider />
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 48 }}>
          <div style={{ flex: 1, color: 'var(--text-body)' }}>{t.theme}</div>
          <Segmented
            options={[
              { value: 'system' as const, label: t.themeSystem },
              { value: 'light' as const, label: t.themeLight },
              { value: 'dark' as const, label: t.themeDark }
            ]}
            value={settings.theme}
            onChange={(v) => patch({ theme: v })}
            size="sm"
          />
        </div>
        <Divider />
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 48 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text-body)' }}>{t.autoStart}</div>
            <div style={{ color: 'var(--text-sub)', fontSize: 'var(--text-caption)', marginTop: 'var(--space-1)' }}>
              {t.autoStartDesc}
            </div>
          </div>
          <Toggle checked={settings.autoStart} onChange={(checked) => patch({ autoStart: checked })} aria-label={t.autoStart} />
        </div>
      </Section>

      {/* macOS 전용 권한 안내. TODO(platform-verify): 실기기에서 화면기록 권한 상태 조회 연동 */}
      {window.snaply.platform === 'darwin' && (
        <section style={{ marginTop: 'var(--space-8)' }}>
          <Card style={{ background: 'var(--primary-bg)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-title)' }}>{t.permissionTitle}</div>
            <div style={{ color: 'var(--text-body)', marginTop: 'var(--space-2)', fontSize: 'var(--text-caption)' }}>
              {t.permissionDesc}
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}

export function App(): JSX.Element {
  useTheme()
  return (
    <ToastProvider>
      <SettingsScreen />
    </ToastProvider>
  )
}
