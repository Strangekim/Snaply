/**
 * 에디터 전역 단축키. 소유자: Editor.
 *
 * Ctrl+Z 실행 취소 · Ctrl+Shift+Z/Ctrl+Y 다시 실행 · Ctrl+C 복사
 * Ctrl+V 붙여넣기(클립보드 이미지 우선, 없으면 객체 복제)
 * Ctrl+S 저장 · Ctrl+Shift+C 클립보드 복사 · Delete 삭제 · 방향키 이동
 * V/A/L/R/O/T 도구 전환
 */
import { useEffect } from 'react'
import { useEditorStore } from './store'
import type { ToolId } from './types'

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  a: 'arrow',
  l: 'line',
  r: 'rect',
  o: 'ellipse',
  t: 'text'
}

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)
}

export function useEditorShortcuts(opts: {
  onSave: () => void
  onCopyImage: () => void
}): void {
  const { onSave, onCopyImage } = opts

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (isTypingTarget(e)) return
      const store = useEditorStore.getState()
      const key = e.key.toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl) {
        switch (key) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) store.redo()
            else store.undo()
            return
          case 'y':
            e.preventDefault()
            store.redo()
            return
          case 's':
            e.preventDefault()
            onSave()
            return
          case 'c':
            e.preventDefault()
            if (e.shiftKey) onCopyImage()
            else store.copySelection()
            return
          // Ctrl+V는 window paste 이벤트에서 처리 (클립보드 이미지 우선)
          default:
            return
        }
      }

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          store.deleteSelected()
          return
        case 'Escape':
          store.clearSelection()
          return
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          if (store.selectedIds.length === 0) return
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
          store.moveSelectedBy(dx, dy)
          return
        }
      }

      const tool = TOOL_KEYS[key]
      if (tool && !e.altKey) {
        store.setTool(tool)
      }
    }

    /** Ctrl+V — 클립보드에 이미지가 있으면 이미지 객체로 삽입, 아니면 내부 객체 붙여넣기 */
    const pasteHandler = (e: ClipboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return
      const store = useEditorStore.getState()
      const items = e.clipboardData?.items
      const imageItem = items
        ? Array.from(items).find((it) => it.type.startsWith('image/'))
        : undefined
      if (!imageItem) {
        store.paste()
        return
      }
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const src = typeof reader.result === 'string' ? reader.result : null
        if (!src) return
        const img = new window.Image()
        img.onload = () => {
          useEditorStore.getState().pasteImage(src, img.naturalWidth, img.naturalHeight)
        }
        img.src = src
      }
      reader.readAsDataURL(file)
    }

    window.addEventListener('keydown', handler)
    window.addEventListener('paste', pasteHandler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('paste', pasteHandler)
    }
  }, [onSave, onCopyImage])
}
