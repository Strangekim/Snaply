/**
 * 스텝 카운터 로직 — 에디터 스토어 통합 검증 (zustand는 React 없이도 동작).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../../src/renderer/src/editor/store'
import { createHistory } from '../../src/renderer/src/editor/history'
import type { EditorDoc, StepObj } from '../../src/renderer/src/editor/types'

const emptyDoc = (): EditorDoc => ({ objects: [], crop: null, stepCounter: 0 })

const doc = (): EditorDoc => useEditorStore.getState().history.present

const stepValues = (): number[] =>
  doc()
    .objects.filter((o): o is StepObj => o.type === 'step')
    .map((o) => o.value)

beforeEach(() => {
  useEditorStore.setState({
    history: createHistory(emptyDoc()),
    selectedIds: [],
    editingTextId: null,
    clipboard: []
  })
})

describe('스텝 카운터', () => {
  it('addStep을 반복하면 1, 2, 3으로 증가한다', () => {
    const s = useEditorStore.getState()
    s.addStep({ x: 0, y: 0 })
    s.addStep({ x: 10, y: 10 })
    s.addStep({ x: 20, y: 20 })
    expect(stepValues()).toEqual([1, 2, 3])
    expect(doc().stepCounter).toBe(3)
  })

  it('스텝을 삭제해도 카운터는 줄지 않는다 (다음 번호는 이어짐)', () => {
    const s = useEditorStore.getState()
    s.addStep({ x: 0, y: 0 })
    s.addStep({ x: 10, y: 10 })
    const second = doc().objects[1]
    useEditorStore.getState().select([second.id])
    useEditorStore.getState().deleteSelected()
    expect(stepValues()).toEqual([1])
    expect(doc().stepCounter).toBe(2)
    useEditorStore.getState().addStep({ x: 20, y: 20 })
    expect(stepValues()).toEqual([1, 3])
  })

  it('undo하면 카운터와 객체가 함께 롤백되고 redo로 복원된다', () => {
    const s = useEditorStore.getState()
    s.addStep({ x: 0, y: 0 })
    s.addStep({ x: 10, y: 10 })
    useEditorStore.getState().undo()
    expect(doc().stepCounter).toBe(1)
    expect(stepValues()).toEqual([1])
    useEditorStore.getState().redo()
    expect(doc().stepCounter).toBe(2)
    expect(stepValues()).toEqual([1, 2])
  })

  it('resetStepCounter는 카운터만 0으로 되돌린다 (기존 객체 유지, undo 가능)', () => {
    const s = useEditorStore.getState()
    s.addStep({ x: 0, y: 0 })
    s.addStep({ x: 10, y: 10 })
    useEditorStore.getState().resetStepCounter()
    expect(doc().stepCounter).toBe(0)
    expect(stepValues()).toEqual([1, 2])
    useEditorStore.getState().addStep({ x: 20, y: 20 })
    expect(stepValues()).toEqual([1, 2, 1])
    useEditorStore.getState().undo()
    useEditorStore.getState().undo()
    expect(doc().stepCounter).toBe(2)
  })

  it('카운터가 이미 0이면 resetStepCounter는 히스토리를 만들지 않는다', () => {
    useEditorStore.getState().resetStepCounter()
    expect(useEditorStore.getState().history.past.length).toBe(0)
  })
})
