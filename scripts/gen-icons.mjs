// Snaply 아이콘 생성기 — 외부 에셋 없이 순수 Node로 PNG를 만든다 (법적 안전: 자체 제작).
// 파란 라운드 사각형 + 흰 렌즈 원 형태의 심플한 카메라 모티프.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// 안티앨리어싱: 4x4 슈퍼샘플링
function drawIcon(size) {
  const S = 4
  const W = size * S
  const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const cx = Math.max(x0 + r, Math.min(x, x1 - r))
    const cy = Math.max(y0 + r, Math.min(y, y1 - r))
    const dx = x - cx
    const dy = y - cy
    return dx * dx + dy * dy <= r * r || (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r)
  }
  const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  const rgba = Buffer.alloc(size * size * 4)
  const m = W * 0.06 // 여백
  const rr = W * 0.24 // 라운드 반경
  const lensR = W * 0.21
  const lensInnerR = W * 0.115
  const cx = W / 2
  const cy = W / 2
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = px * S + sx + 0.5
          const y = py * S + sy + 0.5
          let r = 0, g = 0, b = 0, a = 0
          if (inRoundRect(x, y, m, m, W - m, W - m, rr)) {
            // 토스 블루 #3182F6
            r = 0x31; g = 0x82; b = 0xf6; a = 255
            if (inCircle(x, y, cx, cy, lensR)) { r = 255; g = 255; b = 255 }
            if (inCircle(x, y, cx, cy, lensInnerR)) { r = 0x31; g = 0x82; b = 0xf6 }
            // 우상단 플래시 점
            if (inCircle(x, y, W * 0.76, W * 0.24, W * 0.045)) { r = 255; g = 255; b = 255 }
          }
          rSum += r; gSum += g; bSum += b; aSum += a
        }
      }
      const i = (py * size + px) * 4
      const n = S * S
      rgba[i] = Math.round(rSum / n)
      rgba[i + 1] = Math.round(gSum / n)
      rgba[i + 2] = Math.round(bSum / n)
      rgba[i + 3] = Math.round(aSum / n)
    }
  }
  return encodePng(size, size, rgba)
}

mkdirSync(resolve(root, 'resources'), { recursive: true })
for (const size of [16, 32, 256, 512]) {
  writeFileSync(resolve(root, `resources/icon-${size}.png`), drawIcon(size))
}
writeFileSync(resolve(root, 'resources/icon.png'), drawIcon(256))
console.log('icons generated in resources/')
