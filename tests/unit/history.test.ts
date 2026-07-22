import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  undo
} from '../../src/renderer/src/editor/history'

interface Doc {
  items: string[]
  label: string
}

const doc = (label: string, items: string[] = []): Doc => ({ items, label })

describe('createHistory', () => {
  it('초기 상태는 past/future가 비어 있고 undo/redo 불가', () => {
    const h = createHistory(doc('v0'))
    expect(h.past).toEqual([])
    expect(h.future).toEqual([])
    expect(h.present.label).toBe('v0')
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)
  })
})

describe('commit', () => {
  it('커밋하면 present가 past로 밀리고 새 상태가 present가 된다', () => {
    const v0 = doc('v0')
    const v1 = doc('v1')
    const h = commit(createHistory(v0), v1)
    expect(h.past).toEqual([v0])
    expect(h.present).toBe(v1)
    expect(canUndo(h)).toBe(true)
  })

  it('동일 참조를 커밋하면 히스토리 객체 자체가 그대로 반환된다 (no-op)', () => {
    const v0 = doc('v0')
    const h = createHistory(v0)
    expect(commit(h, v0)).toBe(h)
  })

  it('커밋하면 redo 스택(future)이 비워진다', () => {
    let h = createHistory(doc('v0'))
    h = commit(h, doc('v1'))
    h = undo(h)
    expect(canRedo(h)).toBe(true)
    h = commit(h, doc('v2'))
    expect(h.future).toEqual([])
    expect(canRedo(h)).toBe(false)
  })
})

describe('undo / redo', () => {
  it('undo는 직전 상태를 복원하고 현재 상태를 future로 옮긴다', () => {
    const v0 = doc('v0')
    const v1 = doc('v1')
    let h = commit(createHistory(v0), v1)
    h = undo(h)
    expect(h.present).toBe(v0)
    expect(h.future).toEqual([v1])
    expect(canUndo(h)).toBe(false)
  })

  it('past가 비어 있으면 undo는 같은 히스토리를 반환한다', () => {
    const h = createHistory(doc('v0'))
    expect(undo(h)).toBe(h)
  })

  it('future가 비어 있으면 redo는 같은 히스토리를 반환한다', () => {
    const h = commit(createHistory(doc('v0')), doc('v1'))
    expect(redo(h)).toBe(h)
  })

  it('undo 후 redo하면 원래 상태로 완전히 복귀한다 (라운드트립)', () => {
    const v0 = doc('v0')
    const v1 = doc('v1')
    const v2 = doc('v2')
    let h = commit(commit(createHistory(v0), v1), v2)
    const before = h
    h = redo(undo(h))
    expect(h.present).toBe(before.present)
    expect(h.past).toEqual(before.past)
    expect(h.future).toEqual(before.future)
  })

  it('undo/redo 순서: v0→v1→v2 커밋 후 undo×2 → v0, redo×2 → v2', () => {
    const v0 = doc('v0')
    const v1 = doc('v1')
    const v2 = doc('v2')
    let h = commit(commit(createHistory(v0), v1), v2)
    h = undo(undo(h))
    expect(h.present).toBe(v0)
    h = redo(redo(h))
    expect(h.present).toBe(v2)
  })
})

describe('무제한 스택 + 구조 공유', () => {
  it('1000회 커밋해도 스택이 잘리지 않고 전부 undo 가능하다', () => {
    let h = createHistory(doc('v0'))
    for (let i = 1; i <= 1000; i += 1) {
      h = commit(h, doc(`v${i}`))
    }
    expect(h.past.length).toBe(1000)
    for (let i = 0; i < 1000; i += 1) {
      h = undo(h)
    }
    expect(h.present.label).toBe('v0')
    expect(canUndo(h)).toBe(false)
    expect(h.future.length).toBe(1000)
  })

  it('스냅샷은 변경되지 않은 내부 배열을 참조로 공유한다 (구조 공유)', () => {
    const sharedItems = ['a', 'b']
    const v0 = doc('v0', sharedItems)
    // 불변 갱신: items는 그대로 재사용, label만 교체
    const v1: Doc = { ...v0, label: 'v1' }
    const h = commit(createHistory(v0), v1)
    // past 스냅샷과 present가 동일한 items 배열 인스턴스를 공유해야 한다
    expect(h.past[0].items).toBe(h.present.items)
    expect(h.past[0].items).toBe(sharedItems)
  })

  it('스냅샷 자체는 복제 없이 참조 그대로 저장된다', () => {
    const v0 = doc('v0')
    const v1 = doc('v1')
    const h = commit(createHistory(v0), v1)
    expect(h.past[0]).toBe(v0)
    expect(h.present).toBe(v1)
  })
})
