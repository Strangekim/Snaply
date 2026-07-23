/** 보관함 표시용 포맷 유틸. 소유자: Library. */
import { getLocale, translate as t } from '../common/i18n'

function monthDay(d: Date, withYear: boolean): string {
  if (getLocale() === 'en') {
    const opts: Intl.DateTimeFormatOptions = withYear
      ? { year: 'numeric', month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric' }
    return d.toLocaleDateString('en-US', opts)
  }
  return withYear
    ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
    : `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 상대 시간: '방금 전', 'n분 전', 'n시간 전', 'n일 전', 그 이후는 'M월 D일' */
export function relativeTime(epochMs: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - epochMs)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return t('방금 전')
  if (min < 60) return t('{n}분 전', { n: min })
  const hours = Math.floor(min / 60)
  if (hours < 24) return t('{n}시간 전', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('{n}일 전', { n: days })
  const d = new Date(epochMs)
  const sameYear = new Date(now).getFullYear() === d.getFullYear()
  return monthDay(d, !sameYear)
}

/** 타임라인 섹션 헤더: '오늘', '어제', '7월 20일' (다른 해면 연도 포함) */
export function dayLabel(epochMs: number, now: number = Date.now()): string {
  const d = new Date(epochMs)
  const today = new Date(now)
  const startOf = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dayDiff = Math.round((startOf(today) - startOf(d)) / 86_400_000)
  if (dayDiff === 0) return t('오늘')
  if (dayDiff === 1) return t('어제')
  return monthDay(d, today.getFullYear() !== d.getFullYear())
}

/** 날짜(일 단위) 그룹 키 */
export function dayKey(epochMs: number): string {
  const d = new Date(epochMs)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** 경로에서 파일명만 추출 (win/posix 모두) */
export function fileName(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'))
  return idx >= 0 ? filePath.slice(idx + 1) : filePath
}

/** snaply-file:// 프로토콜 URL 생성 (main/protocol.ts의 toSnaplyFileUrl과 동일 규칙) */
export function toSnaplyFileUrl(filePath: string): string {
  return `snaply-file://${encodeURIComponent(filePath)}`
}
