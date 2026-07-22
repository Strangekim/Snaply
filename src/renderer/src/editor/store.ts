/**
 * 에디터 zustand 스토어. 소유자: Editor.
 * 문서(history.present)는 불변 갱신 + 스냅샷 스택으로 무제한 undo/redo.
 */
import { create } from 'zustand'
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo as redoHistory,
  undo as undoHistory,
  type History
} from './history'
import { composeCrop } from './geometry'
import { normalizeEffects } from './effects'
import {
  applyStylePatch,
  baseName,
  cloneObject,
  createImage,
  createStep,
  translateObject
} from './objects'
import type {
  AnnoObject,
  EditorDoc,
  ImageEffects,
  Point,
  RectArea,
  StampKind,
  StyleSettings,
  ToolId
} from './types'

const emptyDoc = (): EditorDoc => ({ objects: [], crop: null, stepCounter: 0 })

const DEFAULT_STYLE: StyleSettings = {
  color: 'red',
  strokeLevel: 'M',
  fontLevel: 'M',
  headLevel: 'M',
  fillEnabled: false,
  blurMode: 'mosaic',
  blurLevel: 'M',
  spotlightShape: 'rect',
  magnifyScale: 2
}

/** 앱바/툴바에서 여는 바텀시트 종류 */
export type EditorSheet = 'stamps' | 'effects' | 'templates' | null

export interface EditorState {
  // 문서 소스
  itemId: string | null
  fileName: string
  imageUrl: string | null
  imageWidth: number
  imageHeight: number

  // 문서 + 히스토리
  history: History<EditorDoc>

  // 편집 세션 상태 (히스토리 비대상)
  selectedIds: string[]
  activeTool: ToolId
  style: StyleSettings
  zoom: number
  pan: Point
  editingTextId: string | null
  clipboard: AnnoObject[]
  /** 스탬프 도구가 배치할 스탬프 종류 */
  stampKind: StampKind
  /** 현재 열린 바텀시트 */
  sheet: EditorSheet

  // 액션
  openDocument: (args: { itemId: string; filePath: string; imageUrl: string; width: number; height: number }) => void
  /** 템플릿 등 파일 기반이 아닌 새 문서 열기 */
  openGeneratedDoc: (args: {
    fileName: string
    imageUrl: string
    width: number
    height: number
    objects?: AnnoObject[]
    stepCounter?: number
  }) => void
  setTool: (tool: ToolId) => void
  setZoomPan: (zoom: number, pan: Point) => void
  setPan: (pan: Point) => void
  select: (ids: string[]) => void
  toggleSelect: (id: string) => void
  clearSelection: () => void
  setEditingText: (id: string | null) => void

  setStampKind: (kind: StampKind) => void
  setSheet: (sheet: EditorSheet) => void

  addObject: (obj: AnnoObject, select?: boolean) => void
  /** 여러 객체를 한 번의 커밋으로 추가 (undo 한 번에 되돌려짐) */
  addObjects: (objs: AnnoObject[], select?: boolean) => void
  addStep: (at: Point) => void
  resetStepCounter: () => void
  updateObject: (id: string, updater: (obj: AnnoObject) => AnnoObject) => void
  updateObjects: (ids: string[], updater: (obj: AnnoObject) => AnnoObject) => void
  commitText: (id: string, text: string) => void
  deleteSelected: () => void
  moveSelectedBy: (dx: number, dy: number) => void
  copySelection: () => void
  paste: () => void
  applyStyle: (patch: Partial<StyleSettings>) => void
  /** 선택 객체와 같은 종류 전체에 현재 스타일을 적용 (한 번의 커밋) */
  applyStyleToSameType: () => void
  applyCrop: (rect: RectArea) => void
  /** 문서 전체 효과 갱신 (undo 가능) */
  updateEffects: (patch: Partial<ImageEffects>) => void
  /** 클립보드 이미지 붙여넣기 — 선택된 프레임이 있으면 그 안에 맞춤 */
  pasteImage: (src: string, width: number, height: number) => void

  undo: () => void
  redo: () => void
}

/** 현재 문서 크기 (크롭 반영) — 컴포넌트에서 셀렉터로 사용 */
export function docSize(s: Pick<EditorState, 'history' | 'imageWidth' | 'imageHeight'>): {
  width: number
  height: number
} {
  const crop = s.history.present.crop
  return crop
    ? { width: crop.width, height: crop.height }
    : { width: s.imageWidth, height: s.imageHeight }
}

export const useEditorStore = create<EditorState>()((set, get) => {
  /** 문서를 커밋하고 존재하지 않는 선택 id를 정리 */
  const commitDoc = (next: EditorDoc): void => {
    set((s) => ({
      history: commit(s.history, next),
      selectedIds: s.selectedIds.filter((id) => next.objects.some((o) => o.id === id))
    }))
  }

  const doc = (): EditorDoc => get().history.present

  return {
    itemId: null,
    fileName: '',
    imageUrl: null,
    imageWidth: 0,
    imageHeight: 0,
    history: createHistory(emptyDoc()),
    selectedIds: [],
    activeTool: 'select',
    style: DEFAULT_STYLE,
    zoom: 1,
    pan: { x: 0, y: 0 },
    editingTextId: null,
    clipboard: [],
    stampKind: 'check',
    sheet: null,

    openDocument: ({ itemId, filePath, imageUrl, width, height }) =>
      set({
        itemId,
        fileName: baseName(filePath),
        imageUrl,
        imageWidth: width,
        imageHeight: height,
        history: createHistory(emptyDoc()),
        selectedIds: [],
        activeTool: 'select',
        editingTextId: null,
        clipboard: []
      }),

    openGeneratedDoc: ({ fileName, imageUrl, width, height, objects = [], stepCounter = 0 }) =>
      set({
        itemId: null,
        fileName,
        imageUrl,
        imageWidth: width,
        imageHeight: height,
        history: createHistory({ objects, crop: null, stepCounter }),
        selectedIds: [],
        activeTool: 'select',
        editingTextId: null,
        clipboard: []
      }),

    setStampKind: (kind) => set({ stampKind: kind, activeTool: 'stamp' }),
    setSheet: (sheet) => set({ sheet }),

    setTool: (tool) =>
      set((s) => ({
        activeTool: tool,
        editingTextId: null,
        selectedIds: tool === 'select' ? s.selectedIds : []
      })),

    setZoomPan: (zoom, pan) => set({ zoom, pan }),
    setPan: (pan) => set({ pan }),

    select: (ids) => set({ selectedIds: ids }),
    toggleSelect: (id) =>
      set((s) => ({
        selectedIds: s.selectedIds.includes(id)
          ? s.selectedIds.filter((v) => v !== id)
          : [...s.selectedIds, id]
      })),
    clearSelection: () => set({ selectedIds: [] }),
    setEditingText: (id) => set({ editingTextId: id }),

    addObject: (obj, select = true) => {
      const d = doc()
      commitDoc({ ...d, objects: [...d.objects, obj] })
      if (select) set({ selectedIds: [obj.id] })
    },

    addObjects: (objs, select = true) => {
      if (objs.length === 0) return
      const d = doc()
      commitDoc({ ...d, objects: [...d.objects, ...objs] })
      if (select) set({ selectedIds: objs.map((o) => o.id) })
    },

    addStep: (at) => {
      const d = doc()
      const value = d.stepCounter + 1
      const obj = createStep(at, value, get().style)
      commitDoc({ ...d, objects: [...d.objects, obj], stepCounter: value })
    },

    resetStepCounter: () => {
      const d = doc()
      if (d.stepCounter === 0) return
      commitDoc({ ...d, stepCounter: 0 })
    },

    updateObject: (id, updater) => get().updateObjects([id], updater),

    updateObjects: (ids, updater) => {
      const d = doc()
      const idSet = new Set(ids)
      let changed = false
      const objects = d.objects.map((o) => {
        if (!idSet.has(o.id)) return o
        const next = updater(o)
        if (next !== o) changed = true
        return next
      })
      if (changed) commitDoc({ ...d, objects })
    },

    commitText: (id, text) => {
      const d = doc()
      const target = d.objects.find((o) => o.id === id)
      set({ editingTextId: null })
      if (!target) return
      const trimmed = text.trimEnd()
      if (target.type === 'text' && trimmed.trim() === '') {
        // 빈 텍스트는 제거
        commitDoc({ ...d, objects: d.objects.filter((o) => o.id !== id) })
        return
      }
      if (target.type === 'text' || target.type === 'callout') {
        if (target.text === trimmed) return
        commitDoc({
          ...d,
          objects: d.objects.map((o) => (o.id === id ? { ...o, text: trimmed } : o))
        })
      }
    },

    deleteSelected: () => {
      const { selectedIds } = get()
      if (selectedIds.length === 0) return
      const d = doc()
      const idSet = new Set(selectedIds)
      commitDoc({ ...d, objects: d.objects.filter((o) => !idSet.has(o.id)) })
      set({ selectedIds: [], editingTextId: null })
    },

    moveSelectedBy: (dx, dy) => {
      const { selectedIds } = get()
      if (selectedIds.length === 0) return
      get().updateObjects(selectedIds, (o) => translateObject(o, dx, dy))
    },

    copySelection: () => {
      const { selectedIds } = get()
      const d = doc()
      const copied = d.objects.filter((o) => selectedIds.includes(o.id))
      if (copied.length > 0) set({ clipboard: copied })
    },

    paste: () => {
      const { clipboard } = get()
      if (clipboard.length === 0) return
      const d = doc()
      const clones = clipboard.map((o) => cloneObject(o))
      commitDoc({ ...d, objects: [...d.objects, ...clones] })
      set({ selectedIds: clones.map((o) => o.id) })
    },

    applyStyle: (patch) => {
      const { selectedIds } = get()
      set((s) => ({ style: { ...s.style, ...patch } }))
      if (selectedIds.length > 0) {
        get().updateObjects(selectedIds, (o) => applyStylePatch(o, patch))
      }
    },

    applyStyleToSameType: () => {
      const { selectedIds, style } = get()
      if (selectedIds.length === 0) return
      const d = doc()
      const idSet = new Set(selectedIds)
      const types = new Set(d.objects.filter((o) => idSet.has(o.id)).map((o) => o.type))
      if (types.size === 0) return
      const targetIds = d.objects.filter((o) => types.has(o.type)).map((o) => o.id)
      get().updateObjects(targetIds, (o) => applyStylePatch(o, style))
    },

    updateEffects: (patch) => {
      const d = doc()
      commitDoc({ ...d, effects: { ...normalizeEffects(d.effects), ...patch } })
    },

    pasteImage: (src, width, height) => {
      const s = get()
      if (!s.imageUrl || width <= 0 || height <= 0) return
      const d = doc()
      const { width: docW, height: docH } = docSize(s)
      const selected = new Set(s.selectedIds)
      const frame = d.objects.find((o) => o.type === 'frame' && selected.has(o.id))
      let obj: AnnoObject
      if (frame && frame.type === 'frame') {
        // 프레임 안에 맞춤 (contain + 중앙 정렬)
        const scale = Math.min(frame.width / width, frame.height / height)
        const w = width * scale
        const h = height * scale
        obj = createImage(
          { x: frame.x + (frame.width - w) / 2, y: frame.y + (frame.height - h) / 2 },
          w,
          h,
          src
        )
      } else {
        // 문서 중앙, 문서보다 크면 80%로 축소
        const scale = Math.min(1, (docW * 0.8) / width, (docH * 0.8) / height)
        const w = width * scale
        const h = height * scale
        obj = createImage({ x: (docW - w) / 2, y: (docH - h) / 2 }, w, h, src)
      }
      commitDoc({ ...d, objects: [...d.objects, obj] })
      set({ selectedIds: [obj.id] })
    },

    applyCrop: (rect) => {
      const s = get()
      if (rect.width < 4 || rect.height < 4) return
      const d = doc()
      const nextCrop = composeCrop(d.crop, rect, s.imageWidth, s.imageHeight)
      commitDoc({
        ...d,
        crop: nextCrop,
        objects: d.objects.map((o) => translateObject(o, -rect.x, -rect.y))
      })
      set({ activeTool: 'select', selectedIds: [] })
    },

    undo: () =>
      set((s) => {
        if (!canUndo(s.history)) return s
        const history = undoHistory(s.history)
        return {
          history,
          editingTextId: null,
          selectedIds: s.selectedIds.filter((id) =>
            history.present.objects.some((o) => o.id === id)
          )
        }
      }),

    redo: () =>
      set((s) => {
        if (!canRedo(s.history)) return s
        const history = redoHistory(s.history)
        return {
          history,
          editingTextId: null,
          selectedIds: s.selectedIds.filter((id) =>
            history.present.objects.some((o) => o.id === id)
          )
        }
      })
  }
})
