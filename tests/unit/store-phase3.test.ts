/**
 * Phase 3 스토어 액션 — 일괄 추가/일괄 스타일/효과/이미지 붙여넣기 (zustand는 React 없이 동작).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../../src/renderer/src/editor/store'
import { createHistory } from '../../src/renderer/src/editor/history'
import {
  STROKE_WIDTH,
  createBlurArea,
  createFrame,
  createRect
} from '../../src/renderer/src/editor/objects'
import type { EditorDoc, ImageObj, StyleSettings } from '../../src/renderer/src/editor/types'

const emptyDoc = (): EditorDoc => ({ objects: [], crop: null, stepCounter: 0 })

const style = (over: Partial<StyleSettings> = {}): StyleSettings => ({
  color: 'red',
  strokeLevel: 'M',
  fontLevel: 'M',
  headLevel: 'M',
  fillEnabled: false,
  ...over
})

const doc = (): EditorDoc => useEditorStore.getState().history.present

beforeEach(() => {
  useEditorStore.setState({
    itemId: null,
    fileName: 'test.png',
    imageUrl: 'data:image/png;base64,stub',
    imageWidth: 1000,
    imageHeight: 800,
    history: createHistory(emptyDoc()),
    selectedIds: [],
    editingTextId: null,
    clipboard: [],
    style: style()
  })
})

describe('addObjects', () => {
  it('여러 객체를 한 번의 커밋으로 추가하고 undo 한 번에 되돌린다', () => {
    const blurs = [
      createBlurArea({ x: 0, y: 0, width: 50, height: 20 }, 'mosaic', 8),
      createBlurArea({ x: 100, y: 0, width: 50, height: 20 }, 'mosaic', 8)
    ]
    useEditorStore.getState().addObjects(blurs)
    expect(doc().objects).toHaveLength(2)
    expect(useEditorStore.getState().selectedIds).toHaveLength(2)
    useEditorStore.getState().undo()
    expect(doc().objects).toHaveLength(0)
  })

  it('빈 배열은 히스토리를 만들지 않는다', () => {
    useEditorStore.getState().addObjects([])
    expect(useEditorStore.getState().history.past).toHaveLength(0)
  })
})

describe('applyStyleToSameType', () => {
  it('선택 객체와 같은 type 전체에 현재 스타일을 적용한다 (단일 커밋)', () => {
    const s = useEditorStore.getState()
    const r1 = createRect({ x: 0, y: 0 }, style({ strokeLevel: 'S' }))
    const r2 = createRect({ x: 50, y: 0 }, style({ strokeLevel: 'S' }))
    const b = createBlurArea({ x: 0, y: 50, width: 30, height: 30 }, 'mosaic', 8)
    s.addObjects([r1, r2, b], false)
    const before = useEditorStore.getState().history.past.length

    useEditorStore.setState({
      selectedIds: [r1.id],
      style: style({ color: 'green', strokeLevel: 'L' })
    })
    useEditorStore.getState().applyStyleToSameType()

    const objs = doc().objects
    const rects = objs.filter((o) => o.type === 'rect')
    expect(rects).toHaveLength(2)
    for (const r of rects) {
      expect(r.color).toBe('green')
      if (r.type === 'rect') expect(r.strokeWidth).toBe(STROKE_WIDTH.L)
    }
    // blur는 다른 타입 — 색만 바뀌지 않아야 함 (선택 종류가 rect뿐이므로)
    const blur = objs.find((o) => o.type === 'blur')
    expect(blur?.color).toBe('black')
    // 단일 커밋 → undo 한 번으로 전체 롤백
    expect(useEditorStore.getState().history.past.length).toBe(before + 1)
    useEditorStore.getState().undo()
    const restored = doc().objects.filter((o) => o.type === 'rect')
    for (const r of restored) {
      if (r.type === 'rect') expect(r.strokeWidth).toBe(STROKE_WIDTH.S)
    }
  })

  it('선택이 없으면 아무 것도 하지 않는다', () => {
    useEditorStore.getState().applyStyleToSameType()
    expect(useEditorStore.getState().history.past).toHaveLength(0)
  })
})

describe('updateEffects', () => {
  it('부분 패치를 정규화된 효과에 병합하고 undo로 되돌린다', () => {
    useEditorStore.getState().updateEffects({ cornerRadius: 16 })
    expect(doc().effects?.cornerRadius).toBe(16)
    expect(doc().effects?.border.enabled).toBe(false)
    useEditorStore.getState().updateEffects({ shadow: { enabled: true } })
    expect(doc().effects?.shadow.enabled).toBe(true)
    expect(doc().effects?.cornerRadius).toBe(16)
    useEditorStore.getState().undo()
    expect(doc().effects?.shadow.enabled).toBe(false)
    expect(doc().effects?.cornerRadius).toBe(16)
  })
})

describe('pasteImage', () => {
  it('선택된 프레임 안에 contain으로 맞춰 배치한다', () => {
    const frame = createFrame({ x: 50, y: 50, width: 200, height: 100 }, '힌트')
    useEditorStore.getState().addObjects([frame])
    useEditorStore.getState().select([frame.id])
    useEditorStore.getState().pasteImage('data:image/png;base64,img', 400, 400)
    const img = doc().objects.find((o) => o.type === 'image') as ImageObj
    expect(img).toBeTruthy()
    expect(img.width).toBe(100)
    expect(img.height).toBe(100)
    expect(img.x).toBe(100) // 50 + (200-100)/2
    expect(img.y).toBe(50) // 50 + (100-100)/2
  })

  it('프레임 선택이 없으면 문서 중앙에 배치 (문서보다 크면 80%로 축소)', () => {
    useEditorStore.getState().pasteImage('data:image/png;base64,img', 2000, 400)
    const img = doc().objects.find((o) => o.type === 'image') as ImageObj
    // scale = min(1, 1000*0.8/2000, 800*0.8/400) = 0.4
    expect(img.width).toBe(800)
    expect(img.height).toBe(160)
    expect(img.x).toBe(100) // (1000-800)/2
    expect(img.y).toBe(320) // (800-160)/2
  })

  it('이미지 문서가 없으면 무시한다', () => {
    useEditorStore.setState({ imageUrl: null })
    useEditorStore.getState().pasteImage('data:x', 100, 100)
    expect(doc().objects).toHaveLength(0)
  })
})
