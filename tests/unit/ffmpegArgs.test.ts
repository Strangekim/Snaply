import { describe, expect, it } from 'vitest'
import {
  buildFfmpegCommands,
  msToSeconds,
  regionToCrop,
  type FfmpegJob
} from '../../src/main/recorder/ffmpegArgs'

const base: FfmpegJob = {
  input: 'C:/tmp/rec.webm',
  output: 'C:/out/snaply.mp4',
  format: 'mp4'
}

describe('msToSeconds', () => {
  it('ms를 소수점 3자리 초 문자열로 바꾼다', () => {
    expect(msToSeconds(0)).toBe('0.000')
    expect(msToSeconds(1500)).toBe('1.500')
    expect(msToSeconds(61234)).toBe('61.234')
  })

  it('음수는 0으로 클램프한다', () => {
    expect(msToSeconds(-100)).toBe('0.000')
  })
})

describe('regionToCrop', () => {
  it('scaleFactor 1이면 좌표를 그대로 쓰되 크기는 짝수로 내림한다', () => {
    expect(regionToCrop({ x: 10, y: 20, width: 301, height: 200 }, 1)).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200
    })
  })

  it('DIP → 물리 픽셀 변환에 scaleFactor를 곱한다 (150% 스케일)', () => {
    expect(regionToCrop({ x: 100, y: 50, width: 400, height: 300 }, 1.5)).toEqual({
      x: 150,
      y: 75,
      width: 600,
      height: 450
    })
  })

  it('홀수 크기는 h264 요구사항에 맞춰 짝수로 내림한다', () => {
    const crop = regionToCrop({ x: 0, y: 0, width: 333, height: 111 }, 1)
    expect(crop.width % 2).toBe(0)
    expect(crop.height % 2).toBe(0)
    expect(crop).toEqual({ x: 0, y: 0, width: 332, height: 110 })
  })

  it('음수 좌표는 0으로, 최소 크기는 2를 보장한다', () => {
    const crop = regionToCrop({ x: -5, y: -3, width: 1, height: 1 }, 1)
    expect(crop).toEqual({ x: 0, y: 0, width: 2, height: 2 })
  })
})

describe('buildFfmpegCommands — mp4', () => {
  it('기본 mp4: 단일 커맨드, h264 + faststart + 짝수 스케일', () => {
    const commands = buildFfmpegCommands({ ...base })
    expect(commands).toHaveLength(1)
    const args = commands[0]
    expect(args[0]).toBe('-y')
    expect(args).toContain('-i')
    expect(args[args.indexOf('-i') + 1]).toBe(base.input)
    expect(args[args.indexOf('-c:v') + 1]).toBe('libx264')
    expect(args[args.indexOf('-pix_fmt') + 1]).toBe('yuv420p')
    expect(args[args.indexOf('-movflags') + 1]).toBe('+faststart')
    expect(args[args.indexOf('-vf') + 1]).toBe('scale=trunc(iw/2)*2:trunc(ih/2)*2')
    expect(args[args.length - 1]).toBe(base.output)
    // 트리밍 없음
    expect(args).not.toContain('-ss')
    expect(args).not.toContain('-t')
  })

  it('트리밍: -ss/-t가 입력(-i) 앞에 온다', () => {
    const [args] = buildFfmpegCommands({ ...base, trimStartMs: 1500, trimEndMs: 6500 })
    const ssIdx = args.indexOf('-ss')
    const tIdx = args.indexOf('-t')
    const inputIdx = args.indexOf('-i')
    expect(args[ssIdx + 1]).toBe('1.500')
    expect(args[tIdx + 1]).toBe('5.000') // 구간 길이 = end - start
    expect(ssIdx).toBeLessThan(inputIdx)
    expect(tIdx).toBeLessThan(inputIdx)
  })

  it('끝 지점만 트리밍하면 -ss 없이 -t만 넣는다', () => {
    const [args] = buildFfmpegCommands({ ...base, trimEndMs: 3000 })
    expect(args).not.toContain('-ss')
    expect(args[args.indexOf('-t') + 1]).toBe('3.000')
  })

  it('crop: 영역 녹화 crop 필터가 스케일 필터 앞에 붙는다', () => {
    const [args] = buildFfmpegCommands({
      ...base,
      crop: { x: 150, y: 75, width: 600, height: 450 }
    })
    expect(args[args.indexOf('-vf') + 1]).toBe(
      'crop=600:450:150:75,scale=trunc(iw/2)*2:trunc(ih/2)*2'
    )
  })

  it('트리밍 + crop 조합', () => {
    const [args] = buildFfmpegCommands({
      ...base,
      trimStartMs: 1000,
      trimEndMs: 4000,
      crop: { x: 0, y: 0, width: 800, height: 600 }
    })
    expect(args[args.indexOf('-ss') + 1]).toBe('1.000')
    expect(args[args.indexOf('-t') + 1]).toBe('3.000')
    expect(args[args.indexOf('-vf') + 1]).toContain('crop=800:600:0:0')
  })
})

describe('buildFfmpegCommands — gif', () => {
  const gifBase: FfmpegJob = {
    input: 'C:/tmp/rec.webm',
    output: 'C:/out/snaply.gif',
    format: 'gif',
    palettePath: 'C:/tmp/palette.png'
  }

  it('팔레트 2패스: palettegen → paletteuse 두 커맨드를 만든다', () => {
    const commands = buildFfmpegCommands({ ...gifBase, fps: 15 })
    expect(commands).toHaveLength(2)
    const [pass1, pass2] = commands
    // 1패스: 팔레트 생성
    expect(pass1[pass1.indexOf('-vf') + 1]).toBe('fps=15,palettegen=stats_mode=diff')
    expect(pass1[pass1.length - 1]).toBe(gifBase.palettePath)
    // 2패스: 팔레트 적용
    expect(pass2).toContain('-lavfi')
    expect(pass2[pass2.indexOf('-lavfi') + 1]).toBe(
      '[0:v]fps=15[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle'
    )
    expect(pass2[pass2.length - 1]).toBe(gifBase.output)
    // 2패스 입력 2개: 원본 + 팔레트
    expect(pass2.filter((a) => a === '-i')).toHaveLength(2)
  })

  it('fps 미지정 시 기본 15를 쓴다', () => {
    const [pass1] = buildFfmpegCommands({ ...gifBase })
    expect(pass1[pass1.indexOf('-vf') + 1]).toContain('fps=15')
  })

  it('fps 옵션(10/24)이 필터 체인에 반영된다', () => {
    const [p10] = buildFfmpegCommands({ ...gifBase, fps: 10 })
    expect(p10[p10.indexOf('-vf') + 1]).toContain('fps=10')
    const [p24] = buildFfmpegCommands({ ...gifBase, fps: 24 })
    expect(p24[p24.indexOf('-vf') + 1]).toContain('fps=24')
  })

  it('트리밍이 두 패스 모두에 동일하게 들어간다', () => {
    const [pass1, pass2] = buildFfmpegCommands({
      ...gifBase,
      fps: 10,
      trimStartMs: 500,
      trimEndMs: 2500
    })
    for (const args of [pass1, pass2]) {
      expect(args[args.indexOf('-ss') + 1]).toBe('0.500')
      expect(args[args.indexOf('-t') + 1]).toBe('2.000')
    }
  })

  it('crop + fps 조합: crop이 fps 앞에 온다', () => {
    const [pass1, pass2] = buildFfmpegCommands({
      ...gifBase,
      fps: 24,
      crop: { x: 10, y: 20, width: 640, height: 480 }
    })
    expect(pass1[pass1.indexOf('-vf') + 1]).toBe(
      'crop=640:480:10:20,fps=24,palettegen=stats_mode=diff'
    )
    expect(pass2[pass2.indexOf('-lavfi') + 1]).toContain('[0:v]crop=640:480:10:20,fps=24[v]')
  })

  it('palettePath가 없으면 던진다', () => {
    expect(() => buildFfmpegCommands({ ...gifBase, palettePath: undefined })).toThrow()
  })
})

describe('buildFfmpegCommands — 경계 조건', () => {
  it('trimStartMs 0은 트리밍으로 취급하지 않는다', () => {
    const [args] = buildFfmpegCommands({ ...base, trimStartMs: 0 })
    expect(args).not.toContain('-ss')
  })

  it('끝이 시작보다 이르면 -t를 생략한다', () => {
    const [args] = buildFfmpegCommands({ ...base, trimStartMs: 5000, trimEndMs: 3000 })
    expect(args[args.indexOf('-ss') + 1]).toBe('5.000')
    expect(args).not.toContain('-t')
  })
})
