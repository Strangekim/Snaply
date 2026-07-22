/**
 * 스마트 리댁션 — 민감정보 패턴 감지 (순수 모듈, DOM/Konva 의존 없음). 소유자: Editor.
 * OCR 단어 목록에서 이메일·전화번호·카드번호(Luhn)·주민등록번호를 찾는다.
 */
import type { RectArea } from './types'

export interface OcrBBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface OcrWordLike {
  text: string
  bbox: OcrBBox
  confidence?: number
}

export type SensitiveKind = 'email' | 'phone' | 'card' | 'rrn'

export interface SensitiveMatch {
  kind: SensitiveKind
  text: string
  bbox: OcrBBox
}

/** 단어 앞뒤의 괄호/문장부호 제거 */
export function stripPunctuation(text: string): string {
  return text.replace(/^[([{<'"“‘]+/, '').replace(/[)\]}>'"”’.,;:!?]+$/, '')
}

/** Luhn 체크섬 검증 — 숫자 문자열만 입력 */
export function luhnValid(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

const EMAIL_RE = /^[\w.+-]+@[\w-]+(\.[\w-]{2,})+$/

// 한국 전화번호: 휴대폰(01X), 서울(02), 지역/인터넷(0XX·070), 국제(+82)
const PHONE_RES: RegExp[] = [
  /^01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}$/, // 휴대폰
  /^02[-.\s]?\d{3,4}[-.\s]?\d{4}$/, // 서울
  /^0[3-6]\d[-.\s]?\d{3,4}[-.\s]?\d{4}$/, // 지역번호
  /^070[-.\s]?\d{3,4}[-.\s]?\d{4}$/, // 인터넷 전화
  /^\+82[-.\s]?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}$/, // 국제 휴대폰
  /^\+82[-.\s]?0?2[-.\s]?\d{3,4}[-.\s]?\d{4}$/ // 국제 서울
]

const CARD_RE = /^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$/

// 주민등록번호: 생년월일(월 01~12, 일 01~31) + 성별코드 1~4
const RRN_RE = /^\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[-\s]?[1-4]\d{6}$/

/** 단일 토큰이 민감정보인지 분류. 아니면 null */
export function classifySensitive(rawText: string): SensitiveKind | null {
  const text = stripPunctuation(rawText.trim())
  if (!text) return null
  if (EMAIL_RE.test(text)) return 'email'
  if (RRN_RE.test(text)) return 'rrn'
  if (CARD_RE.test(text)) {
    const digits = text.replace(/\D/g, '')
    if (luhnValid(digits)) return 'card'
  }
  for (const re of PHONE_RES) {
    if (re.test(text)) return 'phone'
  }
  return null
}

/**
 * OCR 단어 목록에서 민감정보 단어를 찾는다.
 * 카드번호가 "1234 5678 9012 3456"처럼 4단어로 쪼개진 경우도
 * 연속 4자리 숫자 4개 + Luhn 검증으로 감지한다.
 */
export function findSensitiveWords(words: OcrWordLike[]): SensitiveMatch[] {
  const matches: SensitiveMatch[] = []
  const matched = new Set<number>()

  words.forEach((w, i) => {
    const kind = classifySensitive(w.text)
    if (kind) {
      matched.add(i)
      matches.push({ kind, text: w.text, bbox: w.bbox })
    }
  })

  // 연속 4자리 숫자 4단어 → 카드번호 후보
  const isFourDigits = (i: number): boolean =>
    i < words.length && /^\d{4}$/.test(stripPunctuation(words[i].text.trim()))

  for (let i = 0; i + 3 < words.length; i++) {
    if (matched.has(i) || matched.has(i + 1) || matched.has(i + 2) || matched.has(i + 3)) continue
    if (!(isFourDigits(i) && isFourDigits(i + 1) && isFourDigits(i + 2) && isFourDigits(i + 3)))
      continue
    const digits = [0, 1, 2, 3].map((k) => stripPunctuation(words[i + k].text.trim())).join('')
    if (!luhnValid(digits)) continue
    for (let k = 0; k < 4; k++) {
      matched.add(i + k)
      matches.push({ kind: 'card', text: words[i + k].text, bbox: words[i + k].bbox })
    }
    i += 3
  }

  return matches
}

/**
 * OCR bbox(원본 이미지 좌표) → 현재 문서 좌표의 블러 영역.
 * 크롭 오프셋 반영 + 문서 경계 클램프. 문서 밖이면 null.
 */
export function bboxToDocRect(
  bbox: OcrBBox,
  crop: RectArea | null,
  docWidth: number,
  docHeight: number,
  pad = 4
): RectArea | null {
  const ox = crop?.x ?? 0
  const oy = crop?.y ?? 0
  const x0 = Math.max(0, bbox.x0 - ox - pad)
  const y0 = Math.max(0, bbox.y0 - oy - pad)
  const x1 = Math.min(docWidth, bbox.x1 - ox + pad)
  const y1 = Math.min(docHeight, bbox.y1 - oy + pad)
  if (x1 - x0 < 2 || y1 - y0 < 2) return null
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}
