/**
 * Recorder 창 루트 — 녹화 플로우 상태 머신 (렌더러측 절반). 소유자: Recorder (Phase 3).
 *
 * 페이즈 흐름:
 *   card ──(전체 화면 시작)──────────────► countdown ─► recording ⇄ paused ─► preview ─► saving ─► done
 *     └──(영역 시작)─► select ─(드래그 확정)─┘                        └─(취소)─► card
 *
 * 창 크기(카드↔풀스크린↔캡슐)는 메인 recorder 모듈이 record:* 처리 시 조절하고,
 * countdown/recording/paused 전환은 event:recordState 브로드캐스트로 구동된다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { Button, Card, ToastProvider, useToast } from '@ds/index'
import { useTheme } from '../common/useTheme'
import type { DisplayInfo, RecordOptions, RegionRect } from '@shared/ipc'
import { RecordEngine, blobToDataUrl } from './engine'
import { SettingsCard } from './SettingsCard'
import { RegionSelect } from './RegionSelect'
import { ControlBar } from './ControlBar'
import { TrimPreview } from './TrimPreview'
import { IconCheck, IconFolder } from './icons'
import type { Phase, RecordForm } from './types'
import styles from './recorder.module.css'

function Countdown(): JSX.Element {
  const [count, setCount] = useState(3)
  useEffect(() => {
    if (count <= 1) return undefined
    const timer = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [count])
  return (
    <div className={styles.countdownRoot}>
      <div key={count} className={styles.countdownNumber}>
        {count}
      </div>
    </div>
  )
}

interface DoneViewProps {
  path: string
  onOpenFolder: () => void
  onRetake: () => void
}

function DoneView({ path, onOpenFolder, onRetake }: DoneViewProps): JSX.Element {
  return (
    <div className={styles.panelRoot}>
      <Card padding="lg" className={styles.card}>
        <div className={styles.doneRoot}>
          <div className={styles.doneIcon}>
            <IconCheck />
          </div>
          <h1 className={styles.doneTitle}>저장했어요</h1>
          <div className={styles.donePath}>{path}</div>
          <Button variant="secondary" onClick={onOpenFolder}>
            <IconFolder /> 파일 위치 열기
          </Button>
          <Button variant="ghost" onClick={onRetake}>
            다시 찍기
          </Button>
        </div>
      </Card>
    </div>
  )
}

function RecorderApp(): JSX.Element {
  const { toast } = useToast()

  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [form, setForm] = useState<RecordForm>({
    target: 'fullscreen',
    mic: false,
    systemAudio: true,
    webcam: false,
    format: 'mp4',
    fps: '15'
  })
  const [phase, setPhase] = useState<Phase>('card')
  const [starting, setStarting] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [trim, setTrim] = useState<[number, number]>([0, 0])
  const [savedPath, setSavedPath] = useState('')

  const engineRef = useRef<RecordEngine | null>(null)
  const blobRef = useRef<Blob | null>(null)
  /** MediaRecorder.start()를 이미 호출했는지 */
  const startedRef = useRef(false)
  /** 'recording' 이벤트가 엔진 준비보다 먼저 도착한 경우 표시 */
  const wantStartRef = useRef(false)
  const phaseRef = useRef<Phase>('card')
  phaseRef.current = phase

  useEffect(() => {
    void window.snaply.invoke('capture:listDisplays', undefined).then(setDisplays)
  }, [])

  // 메인의 녹화 상태 브로드캐스트 구독 — countdown/recording/paused 페이즈 구동
  useEffect(() => {
    const off = window.snaply.on('event:recordState', (payload) => {
      switch (payload.state) {
        case 'countdown':
          setPhase('countdown')
          break
        case 'recording': {
          if (payload.elapsedMs != null) setElapsedMs(payload.elapsedMs)
          if (!startedRef.current) {
            const engine = engineRef.current
            if (engine?.ready) {
              engine.start()
              startedRef.current = true
            } else {
              wantStartRef.current = true
            }
          }
          if (phaseRef.current === 'countdown' || phaseRef.current === 'paused') {
            setPhase('recording')
          }
          break
        }
        case 'paused':
          if (payload.elapsedMs != null) setElapsedMs(payload.elapsedMs)
          if (phaseRef.current === 'recording') setPhase('paused')
          break
        default:
          break
      }
    })
    return off
  }, [])

  // 창이 닫힐 때 스트림 정리
  useEffect(() => {
    const onUnload = (): void => engineRef.current?.dispose()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  const resolveDisplay = useCallback(
    (id?: number): DisplayInfo => {
      const fallback: DisplayInfo = {
        id: 0,
        label: '',
        bounds: { x: 0, y: 0, width: window.screen.width, height: window.screen.height },
        scaleFactor: window.devicePixelRatio,
        isPrimary: true
      }
      return (
        displays.find((d) => d.id === id) ??
        displays.find((d) => d.isPrimary) ??
        displays[0] ??
        fallback
      )
    },
    [displays]
  )

  const buildOptions = useCallback(
    (region?: RegionRect): RecordOptions => ({
      mode: form.target,
      region,
      displayId: form.displayId ?? displays.find((d) => d.isPrimary)?.id,
      mic: form.mic,
      systemAudio: form.systemAudio,
      webcam: form.webcam,
      format: form.format,
      fps: form.format === 'gif' ? Number(form.fps) : undefined
    }),
    [form, displays]
  )

  /** 스트림 획득 + MediaRecorder 준비 — 실패 시 카드로 복귀 */
  const prepareEngine = useCallback(
    async (options: RecordOptions): Promise<void> => {
      const engine = new RecordEngine()
      engineRef.current = engine
      try {
        await engine.prepare({
          options,
          display: resolveDisplay(options.region?.displayId ?? options.displayId)
        })
        if (wantStartRef.current && !startedRef.current) {
          engine.start()
          startedRef.current = true
          wantStartRef.current = false
        }
      } catch {
        engine.dispose()
        engineRef.current = null
        wantStartRef.current = false
        await window.snaply.invoke('record:stop', undefined)
        setPhase('card')
        toast('화면 스트림을 가져오지 못했어요', { type: 'error' })
      }
    },
    [resolveDisplay, toast]
  )

  const handleStart = useCallback(async (): Promise<void> => {
    setStarting(true)
    try {
      if (form.target === 'region') {
        // 1단계: region 없이 record:start → 메인이 창을 투명 풀스크린으로 확장 (선택 준비)
        setPhase('select')
        await window.snaply.invoke('record:start', buildOptions(undefined))
      } else {
        const options = buildOptions(undefined)
        await window.snaply.invoke('record:start', options)
        await prepareEngine(options)
      }
    } finally {
      setStarting(false)
    }
  }, [form.target, buildOptions, prepareEngine])

  const handleRegionDone = useCallback(
    async (region: RegionRect): Promise<void> => {
      // 2단계: region을 채워 다시 record:start → 카운트다운 시작
      const options = buildOptions(region)
      await window.snaply.invoke('record:start', options)
      await prepareEngine(options)
    },
    [buildOptions, prepareEngine]
  )

  const handleRegionCancel = useCallback(async (): Promise<void> => {
    await window.snaply.invoke('record:stop', undefined)
    setPhase('card')
  }, [])

  const handlePause = useCallback(async (): Promise<void> => {
    engineRef.current?.pause()
    await window.snaply.invoke('record:pause', undefined)
  }, [])

  const handleResume = useCallback(async (): Promise<void> => {
    engineRef.current?.resume()
    await window.snaply.invoke('record:resume', undefined)
  }, [])

  const handleStop = useCallback(async (): Promise<void> => {
    const engine = engineRef.current
    startedRef.current = false
    wantStartRef.current = false
    const blob = engine ? await engine.stop() : new Blob()
    engineRef.current = null
    const res = await window.snaply.invoke('record:stop', undefined)
    const duration = res.durationMs > 0 ? res.durationMs : 1000
    blobRef.current = blob
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(blob)
    })
    setDurationMs(duration)
    setTrim([0, duration])
    setPhase('preview')
  }, [])

  const handleCancelRecording = useCallback(async (): Promise<void> => {
    engineRef.current?.dispose()
    engineRef.current = null
    startedRef.current = false
    wantStartRef.current = false
    blobRef.current = null
    await window.snaply.invoke('record:stop', undefined)
    setPhase('card')
  }, [])

  const handleSave = useCallback(async (): Promise<void> => {
    const blob = blobRef.current
    if (!blob) return
    setPhase('saving')
    try {
      const webmDataUrl = await blobToDataUrl(blob)
      const result = await window.snaply.invoke('record:finalize', {
        webmDataUrl,
        format: form.format,
        fps: form.format === 'gif' ? Number(form.fps) : undefined,
        trimStartMs: trim[0] > 0 ? trim[0] : undefined,
        trimEndMs: trim[1] < durationMs ? trim[1] : undefined
      })
      setSavedPath(result.filePath)
      setPhase('done')
      toast('저장했어요')
    } catch {
      setPhase('preview')
      toast('저장에 실패했어요', { type: 'error' })
    }
  }, [form.format, form.fps, trim, durationMs, toast])

  const handleRetake = useCallback((): void => {
    blobRef.current = null
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setSavedPath('')
    setPhase('card')
  }, [])

  const handleOpenFolder = useCallback((): void => {
    if (savedPath) void window.snaply.invoke('file:showInFolder', savedPath)
  }, [savedPath])

  switch (phase) {
    case 'card':
      return (
        <SettingsCard
          displays={displays}
          form={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onStart={() => void handleStart()}
          starting={starting}
        />
      )
    case 'select':
      return (
        <RegionSelect
          displayId={resolveDisplay(form.displayId).id}
          onDone={(region) => void handleRegionDone(region)}
          onCancel={() => void handleRegionCancel()}
        />
      )
    case 'countdown':
      return <Countdown />
    case 'recording':
    case 'paused':
      return (
        <ControlBar
          elapsedMs={elapsedMs}
          paused={phase === 'paused'}
          onPause={() => void handlePause()}
          onResume={() => void handleResume()}
          onStop={() => void handleStop()}
          onCancel={() => void handleCancelRecording()}
        />
      )
    case 'preview':
    case 'saving':
      if (!blobUrl) return <div className={styles.fill} />
      return (
        <TrimPreview
          blobUrl={blobUrl}
          durationMs={durationMs}
          trim={trim}
          onTrimChange={setTrim}
          onSave={() => void handleSave()}
          onRetake={handleRetake}
          saving={phase === 'saving'}
        />
      )
    case 'done':
      return <DoneView path={savedPath} onOpenFolder={handleOpenFolder} onRetake={handleRetake} />
    default:
      return <div className={styles.fill} />
  }
}

export function App(): React.JSX.Element {
  useTheme()
  return (
    <ToastProvider>
      <RecorderApp />
    </ToastProvider>
  )
}
