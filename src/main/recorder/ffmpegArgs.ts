/**
 * ffmpeg 인자 생성 — 순수 함수 모듈 (유닛 테스트 대상). 소유자: Recorder.
 * 실제 spawn은 index.ts에서 수행하고, 여기서는 인자 배열만 만든다.
 */

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface FfmpegJob {
  /** 입력 webm 경로 */
  input: string
  /** 최종 출력 경로 (.mp4 / .gif) */
  output: string
  format: 'mp4' | 'gif'
  /** GIF 프레임레이트 (기본 15) */
  fps?: number
  /** 트리밍 시작 (ms) */
  trimStartMs?: number
  /** 트리밍 끝 (ms) */
  trimEndMs?: number
  /** 영역 녹화 crop (물리 픽셀) */
  crop?: CropRect
  /** GIF 팔레트 2패스용 임시 팔레트 파일 경로 (gif면 필수) */
  palettePath?: string
}

const DEFAULT_GIF_FPS = 15

/** ms → ffmpeg 초 단위 문자열 (소수점 3자리) */
export function msToSeconds(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(3)
}

/**
 * DIP 영역 → 물리 픽셀 crop 사각형.
 * h264(yuv420p)는 짝수 해상도를 요구하므로 너비/높이는 짝수로 내림한다.
 */
export function regionToCrop(
  region: { x: number; y: number; width: number; height: number },
  scaleFactor: number
): CropRect {
  const even = (n: number): number => Math.max(2, n - (n % 2))
  return {
    x: Math.max(0, Math.round(region.x * scaleFactor)),
    y: Math.max(0, Math.round(region.y * scaleFactor)),
    width: even(Math.round(region.width * scaleFactor)),
    height: even(Math.round(region.height * scaleFactor))
  }
}

/**
 * 트리밍 인자 — 입력 옵션(-i 앞)에 배치한다.
 * 재인코딩 파이프라인이므로 input-side -ss도 프레임 정확 트리밍이 된다.
 * -to 대신 -t(구간 길이)를 써서 입력 옵션으로도 안전하게 동작시킨다.
 */
function trimArgs(job: FfmpegJob): string[] {
  const args: string[] = []
  const start = job.trimStartMs != null && job.trimStartMs > 0 ? job.trimStartMs : 0
  if (start > 0) args.push('-ss', msToSeconds(start))
  if (job.trimEndMs != null && job.trimEndMs > start) {
    args.push('-t', msToSeconds(job.trimEndMs - start))
  }
  return args
}

function cropFilter(crop?: CropRect): string | null {
  if (!crop) return null
  return `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`
}

/**
 * 변환 커맨드 목록 생성.
 * - mp4: 1개 커맨드 (h264 + faststart)
 * - gif: 2개 커맨드 (팔레트 2패스: palettegen → paletteuse)
 * 반환된 각 배열을 순서대로 `spawn(ffmpegPath, args)` 하면 된다.
 */
export function buildFfmpegCommands(job: FfmpegJob): string[][] {
  if (job.format === 'mp4') {
    const vf = [cropFilter(job.crop), 'scale=trunc(iw/2)*2:trunc(ih/2)*2']
      .filter(Boolean)
      .join(',')
    return [
      [
        '-y',
        ...trimArgs(job),
        '-i',
        job.input,
        '-vf',
        vf,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-movflags',
        '+faststart',
        job.output
      ]
    ]
  }

  // GIF — 팔레트 2패스 (용량·색 품질 최적화)
  if (!job.palettePath) throw new Error('GIF 변환에는 palettePath가 필요해요.')
  const fps = job.fps ?? DEFAULT_GIF_FPS
  const chain = [cropFilter(job.crop), `fps=${fps}`].filter(Boolean).join(',')

  const pass1 = [
    '-y',
    ...trimArgs(job),
    '-i',
    job.input,
    '-vf',
    `${chain},palettegen=stats_mode=diff`,
    job.palettePath
  ]
  const pass2 = [
    '-y',
    ...trimArgs(job),
    '-i',
    job.input,
    '-i',
    job.palettePath,
    '-lavfi',
    `[0:v]${chain}[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    job.output
  ]
  return [pass1, pass2]
}
