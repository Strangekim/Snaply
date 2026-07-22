/**
 * 스마트 리댁션 — 민감정보 패턴 감지 유닛 테스트.
 */
import { describe, expect, it } from 'vitest'
import {
  bboxToDocRect,
  classifySensitive,
  findSensitiveWords,
  luhnValid,
  stripPunctuation,
  type OcrWordLike
} from '../../src/renderer/src/editor/redaction'

const word = (text: string, x = 0): OcrWordLike => ({
  text,
  bbox: { x0: x, y0: 10, x1: x + 50, y1: 30 },
  confidence: 90
})

describe('luhnValid', () => {
  it('유효한 카드번호(테스트 번호)를 통과시킨다', () => {
    expect(luhnValid('4111111111111111')).toBe(true) // Visa 테스트
    expect(luhnValid('5500005555555559')).toBe(true) // MC 테스트
  })

  it('체크섬이 틀리면 거부한다', () => {
    expect(luhnValid('4111111111111112')).toBe(false)
    expect(luhnValid('1234567890123456')).toBe(false)
  })

  it('숫자가 아니거나 길이가 벗어나면 거부한다', () => {
    expect(luhnValid('4111-1111-1111-1111')).toBe(false)
    expect(luhnValid('12345')).toBe(false)
    expect(luhnValid('')).toBe(false)
  })
})

describe('classifySensitive — 이메일', () => {
  it('일반 이메일을 감지한다', () => {
    expect(classifySensitive('user@example.com')).toBe('email')
    expect(classifySensitive('kim.cheolsu+tag@company.co.kr')).toBe('email')
  })

  it('괄호/문장부호가 붙어도 감지한다', () => {
    expect(classifySensitive('(user@example.com)')).toBe('email')
    expect(classifySensitive('user@example.com,')).toBe('email')
  })

  it('이메일이 아닌 텍스트는 무시한다', () => {
    expect(classifySensitive('user@localhost')).toBeNull() // TLD 없음
    expect(classifySensitive('안녕하세요')).toBeNull()
    expect(classifySensitive('@mention')).toBeNull()
  })
})

describe('classifySensitive — 전화번호', () => {
  it('휴대폰 번호(01X)를 감지한다', () => {
    expect(classifySensitive('010-1234-5678')).toBe('phone')
    expect(classifySensitive('01012345678')).toBe('phone')
    expect(classifySensitive('011-123-4567')).toBe('phone')
  })

  it('서울(02)·지역·인터넷 번호를 감지한다', () => {
    expect(classifySensitive('02-312-4567')).toBe('phone')
    expect(classifySensitive('02-1234-5678')).toBe('phone')
    expect(classifySensitive('031-123-4567')).toBe('phone')
    expect(classifySensitive('070-7777-8888')).toBe('phone')
  })

  it('국제 형식(+82)을 감지한다', () => {
    expect(classifySensitive('+82-10-1234-5678')).toBe('phone')
    expect(classifySensitive('+82 010-1234-5678')).toBe('phone')
  })

  it('전화번호가 아닌 숫자는 무시한다', () => {
    expect(classifySensitive('1234-5678')).toBeNull() // 국번 없음
    expect(classifySensitive('010-12-34')).toBeNull() // 자릿수 부족
    expect(classifySensitive('12345678901')).toBeNull() // 0으로 시작 안 함
  })
})

describe('classifySensitive — 카드번호', () => {
  it('Luhn을 통과하는 4-4-4-4 형식을 감지한다', () => {
    expect(classifySensitive('4111-1111-1111-1111')).toBe('card')
    expect(classifySensitive('4111 1111 1111 1111')).toBe('card')
    expect(classifySensitive('4111111111111111')).toBe('card')
  })

  it('Luhn 실패 시 카드로 판정하지 않는다', () => {
    expect(classifySensitive('1234-5678-9012-3456')).toBeNull()
    expect(classifySensitive('1111-2222-3333-4445')).toBeNull()
  })
})

describe('classifySensitive — 주민등록번호', () => {
  it('유효한 형식을 감지한다', () => {
    expect(classifySensitive('900101-1234567')).toBe('rrn')
    expect(classifySensitive('031231-4234567')).toBe('rrn')
    expect(classifySensitive('9001011234567')).toBe('rrn')
  })

  it('월/일/성별코드가 어긋나면 무시한다', () => {
    expect(classifySensitive('901301-1234567')).toBeNull() // 13월
    expect(classifySensitive('900132-1234567')).toBeNull() // 32일
    expect(classifySensitive('900101-5234567')).toBeNull() // 성별코드 5
    expect(classifySensitive('900101-123456')).toBeNull() // 자릿수 부족
  })
})

describe('findSensitiveWords', () => {
  it('여러 종류의 민감정보를 한 번에 찾는다', () => {
    const words = [
      word('연락처:'),
      word('010-1234-5678', 60),
      word('메일'),
      word('user@example.com', 120),
      word('일반텍스트')
    ]
    const found = findSensitiveWords(words)
    expect(found).toHaveLength(2)
    expect(found.map((m) => m.kind).sort()).toEqual(['email', 'phone'])
    expect(found.find((m) => m.kind === 'phone')?.bbox.x0).toBe(60)
  })

  it('4단어로 쪼개진 카드번호를 Luhn 검증 후 4개 모두 매칭한다', () => {
    const words = [word('4111'), word('1111', 60), word('1111', 120), word('1111', 180)]
    const found = findSensitiveWords(words)
    expect(found).toHaveLength(4)
    expect(found.every((m) => m.kind === 'card')).toBe(true)
  })

  it('쪼개진 4자리 숫자라도 Luhn 실패면 매칭하지 않는다', () => {
    const words = [word('1234'), word('5678', 60), word('9012', 120), word('3456', 180)]
    expect(findSensitiveWords(words)).toHaveLength(0)
  })

  it('민감정보가 없으면 빈 배열을 반환한다', () => {
    expect(findSensitiveWords([word('보통'), word('텍스트')])).toHaveLength(0)
    expect(findSensitiveWords([])).toHaveLength(0)
  })
})

describe('stripPunctuation', () => {
  it('앞뒤 괄호·문장부호만 제거하고 내부는 유지한다', () => {
    expect(stripPunctuation('(010-1234-5678)')).toBe('010-1234-5678')
    expect(stripPunctuation('"user@a.com".')).toBe('user@a.com')
    expect(stripPunctuation('a.b-c')).toBe('a.b-c')
  })
})

describe('bboxToDocRect', () => {
  const bbox = { x0: 100, y0: 50, x1: 200, y1: 80 }

  it('크롭이 없으면 패딩만 더해 변환한다', () => {
    const r = bboxToDocRect(bbox, null, 1000, 800)
    expect(r).toEqual({ x: 96, y: 46, width: 108, height: 38 })
  })

  it('크롭 오프셋을 빼서 문서 좌표로 변환한다', () => {
    const r = bboxToDocRect(bbox, { x: 50, y: 20, width: 500, height: 400 }, 500, 400)
    expect(r).toEqual({ x: 46, y: 26, width: 108, height: 38 })
  })

  it('문서 경계로 클램프한다', () => {
    const r = bboxToDocRect(bbox, null, 150, 60)
    expect(r).toEqual({ x: 96, y: 46, width: 54, height: 14 })
  })

  it('크롭으로 잘려나간 영역은 null을 반환한다', () => {
    expect(bboxToDocRect(bbox, { x: 500, y: 0, width: 300, height: 300 }, 300, 300)).toBeNull()
  })
})
