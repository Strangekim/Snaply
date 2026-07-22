import { describe, expect, it } from 'vitest'
import { createZip } from '../../src/main/zip'
import { buildPptx } from '../../src/main/exportPptx'

// 1×1 투명 PNG
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

describe('createZip', () => {
  it('ZIP 시그니처와 EOCD를 기록한다', () => {
    const zip = createZip([{ name: 'a.txt', data: Buffer.from('hello') }], new Date(2026, 6, 22))
    expect(zip.readUInt32LE(0)).toBe(0x04034b50)
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50)
    expect(zip.readUInt16LE(zip.length - 22 + 8)).toBe(1) // entry count
  })

  it('여러 엔트리의 오프셋이 누적된다', () => {
    const zip = createZip(
      [
        { name: 'a', data: Buffer.from('x') },
        { name: 'b', data: Buffer.from('yz') }
      ],
      new Date(2026, 6, 22)
    )
    expect(zip.readUInt16LE(zip.length - 22 + 8)).toBe(2)
    // 두 번째 central directory 엔트리의 로컬 헤더 오프셋 = 30 + 1 + 1
    const centralOffset = zip.readUInt32LE(zip.length - 22 + 16)
    expect(zip.readUInt32LE(centralOffset, )).toBe(0x02014b50)
  })
})

describe('buildPptx', () => {
  it('필수 OOXML 파트를 포함한다', () => {
    const pptx = buildPptx([{ png: TINY_PNG, width: 100, height: 50 }], new Date(2026, 6, 22))
    const text = pptx.toString('latin1')
    for (const part of [
      '[Content_Types].xml',
      '_rels/.rels',
      'ppt/presentation.xml',
      'ppt/slideMasters/slideMaster1.xml',
      'ppt/slideLayouts/slideLayout1.xml',
      'ppt/theme/theme1.xml',
      'ppt/slides/slide1.xml',
      'ppt/media/image1.png'
    ]) {
      expect(text).toContain(part)
    }
  })

  it('슬라이드 수만큼 파트를 만든다', () => {
    const imgs = [
      { png: TINY_PNG, width: 10, height: 10 },
      { png: TINY_PNG, width: 20, height: 20, caption: '2단계: 버튼을 눌러요' }
    ]
    const text = buildPptx(imgs, new Date(2026, 6, 22)).toString('latin1')
    expect(text).toContain('ppt/slides/slide2.xml')
    expect(text).toContain('ppt/media/image2.png')
  })

  it('캡션 XML 이스케이프가 동작한다', () => {
    const text = buildPptx(
      [{ png: TINY_PNG, width: 10, height: 10, caption: 'a<b>&"c"' }],
      new Date(2026, 6, 22)
    ).toString('utf-8')
    expect(text).toContain('a&lt;b&gt;&amp;&quot;c&quot;')
  })

  it('빈 배열이면 해요체 에러를 던진다', () => {
    expect(() => buildPptx([])).toThrow('내보낼 이미지가 없어요.')
  })
})
