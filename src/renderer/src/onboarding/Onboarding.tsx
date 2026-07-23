/** 첫 실행 온보딩 — 토스식 3단계 풀스크린. 소유자: Architect (Phase 4). */
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Button } from '@ds/index'
import { translate } from '../common/i18n'
import { useI18n } from '../common/i18n'

interface StepDef {
  title: string
  desc: string
  art: JSX.Element
}

function CaptureArt(): JSX.Element {
  return (
    <svg width="180" height="140" viewBox="0 0 180 140" fill="none" aria-hidden="true">
      <rect x="20" y="20" width="140" height="94" rx="14" fill="var(--bg-card)" stroke="var(--border-divider)" />
      <rect x="34" y="36" width="70" height="10" rx="5" fill="var(--grey-200)" />
      <rect x="34" y="54" width="112" height="8" rx="4" fill="var(--grey-100)" />
      <rect x="34" y="68" width="96" height="8" rx="4" fill="var(--grey-100)" />
      <rect x="52" y="46" width="86" height="52" rx="8" stroke="var(--primary)" strokeWidth="3" strokeDasharray="8 6" fill="none" />
      <circle cx="52" cy="46" r="5" fill="var(--primary)" />
      <circle cx="138" cy="98" r="5" fill="var(--primary)" />
    </svg>
  )
}

function HotkeyArt(): JSX.Element {
  const isMac = window.snaply.platform === 'darwin'
  return (
    <svg width="220" height="140" viewBox="0 0 220 140" fill="none" aria-hidden="true">
      <rect x="30" y="45" width={isMac ? 80 : 120} height="50" rx="10" fill="var(--bg-card)" stroke="var(--border-divider)" />
      <text
        x={isMac ? 70 : 90}
        y="76"
        textAnchor="middle"
        fill="var(--text-title)"
        fontSize="16"
        fontWeight="600"
        fontFamily="var(--font)"
      >
        {isMac ? '⌃⌥A' : 'Ctrl+Alt+A'}
      </text>
      <circle cx="180" cy="40" r="16" fill="var(--primary)" />
      <path d="M173 40l5 5 9-10" stroke="var(--white)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ReadyArt(): JSX.Element {
  return (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" aria-hidden="true">
      <circle cx="80" cy="66" r="44" fill="var(--primary-bg)" />
      <circle cx="80" cy="66" r="30" fill="var(--primary)" />
      <path d="M66 66l10 10 18-20" stroke="var(--white)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function buildSteps(): StepDef[] {
  const isMac = window.snaply.platform === 'darwin'
  const t = translate
  return [
    {
      title: t('만나서 반가워요'),
      desc: t('Snaply는 캡처, 편집, 녹화, 텍스트 추출까지\n한 번에 되는 화면 캡처 앱이에요.'),
      art: <CaptureArt />
    },
    {
      title: t('단축키 하나면 돼요'),
      desc: isMac
        ? t('⌃⌥A를 누르면 어디서든 캡처가 시작돼요.\n설정에서 언제든 바꿀 수 있어요.')
        : t('Ctrl+Alt+A를 누르면 어디서든 캡처가 시작돼요.\n설정에서 언제든 바꿀 수 있어요.'),
      art: <HotkeyArt />
    },
    isMac
      ? {
          title: t('권한만 허용하면 끝나요'),
          desc: t('시스템 설정 > 개인정보 보호 및 보안 > 화면 기록에서\nSnaply를 허용해 주세요. 허용해야 화면이 캡처돼요.'),
          art: <ReadyArt />
        }
      : {
          title: t('준비 끝!'),
          desc: t('캡처한 이미지는 보관함에 자동으로 쌓이고,\n검색으로 언제든 다시 찾을 수 있어요.'),
          art: <ReadyArt />
        }
  ]
}

export function Onboarding({ onDone }: { onDone: () => void }): JSX.Element {
  const { t } = useI18n()
  // locale이 바뀌면 다시 계산되도록 렌더마다 생성 (스텝 3개 — 비용 미미)
  const steps = buildSteps()
  const [step, setStep] = useState(0)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const last = step === steps.length - 1
  const current = steps[step]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--bg-page)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
        opacity: entered ? 1 : 0,
        transition: 'opacity var(--transition-base)'
      }}
    >
      <div
        key={step}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'snaply-onboard-in 200ms ease-out'
        }}
      >
        <style>{`@keyframes snaply-onboard-in { from { opacity: 0; transform: translateX(24px);} to { opacity: 1; transform: none;} }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`}</style>
        {current.art}
        <h1
          style={{
            fontSize: 'var(--text-h1)',
            fontWeight: 700,
            color: 'var(--text-title)',
            margin: 'var(--space-6) 0 0'
          }}
        >
          {current.title}
        </h1>
        <p
          style={{
            color: 'var(--text-sub)',
            marginTop: 'var(--space-3)',
            whiteSpace: 'pre-line',
            lineHeight: 1.6
          }}
        >
          {current.desc}
        </p>
      </div>

      {/* 진행 점 */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-8)' }} aria-hidden="true">
        {steps.map((_, i) => (
          <span
            key={i}
            style={{
              width: i === step ? 20 : 8,
              height: 8,
              borderRadius: 'var(--radius-capsule)',
              background: i === step ? 'var(--primary)' : 'var(--grey-300)',
              transition: 'all var(--transition-base)'
            }}
          />
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 400, marginTop: 'var(--space-8)' }}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => {
            if (last) onDone()
            else setStep((s) => s + 1)
          }}
        >
          {last ? t('시작하기') : t('다음')}
        </Button>
      </div>
    </div>
  )
}
