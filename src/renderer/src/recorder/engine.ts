/**
 * 녹화 엔진 — MediaRecorder 기반. 소유자: Recorder (Phase 3).
 * - 화면 스트림: getDisplayMedia (메인의 setDisplayMediaRequestHandler가 소스 공급)
 * - 웹캠 PIP: 오프스크린 canvas 합성 (requestAnimationFrame 루프, 우하단 원형)
 * - 오디오: 마이크 + 시스템 오디오(loopback) — 둘 다 있으면 AudioContext로 믹싱
 */
import type { DisplayInfo, RecordOptions } from '@shared/ipc'
import { translate } from '../common/i18n'

export interface EngineConfig {
  options: RecordOptions
  /** 녹화 대상 디스플레이 정보 (PIP 좌표 계산용) */
  display: DisplayInfo
}

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
]

function pickMimeType(): string {
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
}

async function attachVideo(stream: MediaStream): Promise<HTMLVideoElement> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play()
  return video
}

export class RecordEngine {
  private chunks: Blob[] = []
  private recorder: MediaRecorder | null = null
  private rawStreams: MediaStream[] = []
  private audioCtx: AudioContext | null = null
  private raf = 0
  /** GC 방지를 위해 합성용 비디오 요소를 붙잡아 둔다 */
  private composeVideos: HTMLVideoElement[] = []
  private mimeType = pickMimeType()

  get ready(): boolean {
    return this.recorder != null
  }

  get recording(): boolean {
    return this.recorder?.state === 'recording' || this.recorder?.state === 'paused'
  }

  /** 스트림 획득 + 합성 + MediaRecorder 준비 (start 전 호출) */
  async prepare(config: EngineConfig): Promise<void> {
    const { options } = config

    // 1) 화면 스트림 — 시스템 오디오(loopback) 실패 시 오디오 없이 재시도
    // TODO(platform-verify): macOS는 loopback 미지원이라 이 폴백 경로를 탄다
    let screenStream: MediaStream
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: options.systemAudio
      })
    } catch (err) {
      if (!options.systemAudio) throw err
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    }
    this.rawStreams.push(screenStream)

    // 2) 마이크 (실패해도 녹화는 계속)
    let micStream: MediaStream | null = null
    if (options.mic) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        this.rawStreams.push(micStream)
      } catch {
        micStream = null
      }
    }

    // 3) 웹캠 (실패해도 녹화는 계속)
    let camStream: MediaStream | null = null
    if (options.webcam) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        this.rawStreams.push(camStream)
      } catch {
        camStream = null
      }
    }

    // 4) 비디오 스트림: 웹캠이 있으면 canvas 합성, 없으면 화면 트랙 그대로
    const recordStream = camStream
      ? await this.composeWithWebcam(screenStream, camStream, config)
      : new MediaStream(screenStream.getVideoTracks())

    // 5) 오디오 결합 — 2개 이상이면 AudioContext 믹싱 (MediaRecorder는 단일 오디오 트랙만 안정적)
    const audioTracks = [
      ...screenStream.getAudioTracks(),
      ...(micStream?.getAudioTracks() ?? [])
    ]
    if (audioTracks.length === 1) {
      recordStream.addTrack(audioTracks[0])
    } else if (audioTracks.length > 1) {
      const ctx = new AudioContext()
      const dest = ctx.createMediaStreamDestination()
      for (const track of audioTracks) {
        ctx.createMediaStreamSource(new MediaStream([track])).connect(dest)
      }
      this.audioCtx = ctx
      const mixed = dest.stream.getAudioTracks()[0]
      if (mixed) recordStream.addTrack(mixed)
    }

    const recorder = new MediaRecorder(recordStream, {
      mimeType: this.mimeType,
      videoBitsPerSecond: 12_000_000
    })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.recorder = recorder
  }

  /** 화면 + 웹캠 PIP 합성 캔버스 스트림 생성 */
  private async composeWithWebcam(
    screenStream: MediaStream,
    camStream: MediaStream,
    config: EngineConfig
  ): Promise<MediaStream> {
    const { options, display } = config
    const screenVideo = await attachVideo(screenStream)
    const camVideo = await attachVideo(camStream)
    this.composeVideos = [screenVideo, camVideo]

    const settings = screenStream.getVideoTracks()[0]?.getSettings() ?? {}
    const width = settings.width ?? Math.round(display.bounds.width * display.scaleFactor)
    const height = settings.height ?? Math.round(display.bounds.height * display.scaleFactor)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('캔버스를 만들지 못했어요.')

    // PIP 기준 영역: 영역 녹화면 그 영역(물리 픽셀) — crop 후에도 PIP가 살아남도록
    const scaleX = width / display.bounds.width
    const scaleY = height / display.bounds.height
    const region = options.mode === 'region' ? options.region : undefined
    const anchor = region
      ? {
          x: region.x * scaleX,
          y: region.y * scaleY,
          w: region.width * scaleX,
          h: region.height * scaleY
        }
      : { x: 0, y: 0, w: width, h: height }

    const minDim = Math.min(anchor.w, anchor.h)
    const diameter = Math.round(Math.min(Math.max(minDim * 0.24, 96), 288))
    const margin = Math.round(16 * scaleX)
    const cx = anchor.x + anchor.w - diameter / 2 - margin
    const cy = anchor.y + anchor.h - diameter / 2 - margin

    const draw = (): void => {
      ctx.drawImage(screenVideo, 0, 0, width, height)
      if (camVideo.readyState >= 2 && camVideo.videoWidth > 0) {
        // 원형 클립 + cover 맞춤
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, diameter / 2, 0, Math.PI * 2)
        ctx.clip()
        const scale = Math.max(diameter / camVideo.videoWidth, diameter / camVideo.videoHeight)
        const dw = camVideo.videoWidth * scale
        const dh = camVideo.videoHeight * scale
        ctx.drawImage(camVideo, cx - dw / 2, cy - dh / 2, dw, dh)
        ctx.restore()
        ctx.beginPath()
        ctx.arc(cx, cy, diameter / 2, 0, Math.PI * 2)
        ctx.lineWidth = Math.max(2, Math.round(3 * scaleX))
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.stroke()
      }
      this.raf = requestAnimationFrame(draw)
    }
    draw()

    return canvas.captureStream(30)
  }

  start(): void {
    if (this.recorder && this.recorder.state === 'inactive') {
      this.chunks = []
      this.recorder.start(1000)
    }
  }

  pause(): void {
    if (this.recorder?.state === 'recording') this.recorder.pause()
  }

  resume(): void {
    if (this.recorder?.state === 'paused') this.recorder.resume()
  }

  /** 녹화를 멈추고 최종 WebM Blob을 돌려준다. 스트림도 함께 해제한다 */
  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const recorder = this.recorder
      const finish = (): void => {
        const blob = new Blob(this.chunks, { type: this.mimeType })
        this.releaseStreams()
        resolve(blob)
      }
      if (!recorder || recorder.state === 'inactive') {
        finish()
        return
      }
      recorder.onstop = finish
      recorder.stop()
    })
  }

  /** 즉시 폐기 (취소) — 데이터를 버리고 스트림 해제 */
  dispose(): void {
    try {
      if (this.recorder && this.recorder.state !== 'inactive') {
        this.recorder.onstop = null
        this.recorder.stop()
      }
    } catch {
      // 이미 중지된 경우 무시
    }
    this.chunks = []
    this.releaseStreams()
  }

  private releaseStreams(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    }
    for (const stream of this.rawStreams) {
      for (const track of stream.getTracks()) track.stop()
    }
    this.rawStreams = []
    for (const video of this.composeVideos) {
      video.srcObject = null
    }
    this.composeVideos = []
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => undefined)
      this.audioCtx = null
    }
    this.recorder = null
  }
}

/** Blob → dataURL (record:finalize 전송용) */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(translate('녹화 데이터를 읽지 못했어요.')))
    reader.readAsDataURL(blob)
  })
}

/** ms → "mm:ss" 표시용 */
export function formatElapsed(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
