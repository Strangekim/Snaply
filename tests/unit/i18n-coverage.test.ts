/**
 * i18n 커버리지 검증 — 렌더러 소스의 모든 t('...')/translate('...') 한국어 키가
 * EN 사전에 존재하는지 확인한다. 누락되면 영어 로케일에서 한국어가 그대로 노출된다.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { EN } from '../../src/renderer/src/common/i18n'

const RENDERER_ROOT = join(__dirname, '../../src/renderer/src')

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) collectFiles(full, acc)
    else if (/\.(ts|tsx)$/.test(name) && !full.includes('i18n.ts')) acc.push(full)
  }
  return acc
}

/** t('...') / translate('...') 호출의 첫 번째 문자열 리터럴 추출 (한글 포함 키만) */
function extractKeys(source: string): string[] {
  const keys: string[] = []
  const re = /\b(?:t|translate)\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const key = m[2].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"')
    if (/[가-힣]/.test(key)) keys.push(key)
  }
  return keys
}

describe('i18n EN 사전 커버리지', () => {
  it('소스의 모든 한국어 t() 키에 영어 번역이 있다', () => {
    const missing = new Map<string, string[]>()
    for (const file of collectFiles(RENDERER_ROOT)) {
      // 설정 화면은 자체 사전(strings.ts)을 쓴다 — 제외
      if (file.includes('settings') && file.endsWith('strings.ts')) continue
      const source = readFileSync(file, 'utf-8')
      for (const key of extractKeys(source)) {
        if (!(key in EN)) {
          const list = missing.get(key) ?? []
          list.push(file.replace(RENDERER_ROOT, ''))
          missing.set(key, list)
        }
      }
    }
    const report = [...missing.entries()].map(([k, files]) => `'${k}' ← ${files.join(', ')}`).join('\n')
    expect(missing.size, `EN 사전에 누락된 키 ${missing.size}개:\n${report}`).toBe(0)
  })

  it('사전의 영어 값에 한국어가 섞여 있지 않다', () => {
    const bad = Object.entries(EN).filter(([, en]) => /[가-힣]/.test(en))
    expect(bad.map(([k]) => k)).toEqual([])
  })
})
