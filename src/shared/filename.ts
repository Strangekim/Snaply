/** 파일명 패턴 포매팅 — 순수 함수 (테스트 가능) */
export function formatFilename(pattern: string, date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (pattern || 'snaply-{yyyy}{MM}{dd}-{HH}{mm}{ss}')
    .replaceAll('{yyyy}', String(date.getFullYear()))
    .replaceAll('{MM}', pad(date.getMonth() + 1))
    .replaceAll('{dd}', pad(date.getDate()))
    .replaceAll('{HH}', pad(date.getHours()))
    .replaceAll('{mm}', pad(date.getMinutes()))
    .replaceAll('{ss}', pad(date.getSeconds()))
}
