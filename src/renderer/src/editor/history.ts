/**
 * 무제한 undo/redo — 순수 스냅샷 스택. 소유자: Editor.
 * 문서는 불변 갱신되므로 스냅샷은 구조 공유로 가볍다.
 */

export interface History<T> {
  past: T[]
  present: T
  future: T[]
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

/** 새 상태를 커밋한다. redo 스택은 비워진다. */
export function commit<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h
  return { past: [...h.past, h.present], present: next, future: [] }
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0
}

export function undo<T>(h: History<T>): History<T> {
  if (!canUndo(h)) return h
  const previous = h.past[h.past.length - 1]
  return {
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future]
  }
}

export function redo<T>(h: History<T>): History<T> {
  if (!canRedo(h)) return h
  const next = h.future[0]
  return {
    past: [...h.past, h.present],
    present: next,
    future: h.future.slice(1)
  }
}
