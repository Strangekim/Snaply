/**
 * 텍스트 인라인 편집 — Konva 위 absolute textarea 오버레이. 소유자: Editor.
 * 편집 중에는 해당 Konva Text가 숨겨지고 같은 위치에 textarea가 뜬다.
 */
import { useEffect, useRef, useState, type JSX } from 'react'
import { translate } from '../common/i18n'
import styles from './editor.module.css'
import { useEditorStore } from './store'
import { resolveColor, contrastTextColor, CANVAS_FONT } from './palette'
import { CALLOUT_PADDING } from './objects'

export function TextEditOverlay(): JSX.Element | null {
  const editingTextId = useEditorStore((s) => s.editingTextId)
  const objects = useEditorStore((s) => s.history.present.objects)
  const zoom = useEditorStore((s) => s.zoom)
  const pan = useEditorStore((s) => s.pan)
  const commitText = useEditorStore((s) => s.commitText)

  const obj = objects.find((o) => o.id === editingTextId)
  const editable = obj && (obj.type === 'text' || obj.type === 'callout') ? obj : null

  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    if (editable) {
      setValue(editable.text)
      committedRef.current = false
      // 마운트 직후 포커스 + 커서 끝으로
      requestAnimationFrame(() => {
        const el = ref.current
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }
      })
    }
    // 편집 대상이 바뀔 때만 초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTextId])

  if (!editable) return null

  const isCallout = editable.type === 'callout'
  const left = (editable.x + (isCallout ? CALLOUT_PADDING : 0)) * zoom + pan.x
  const top = (editable.y + (isCallout ? CALLOUT_PADDING : 0)) * zoom + pan.y
  const width = isCallout
    ? Math.max((editable.width - CALLOUT_PADDING * 2) * zoom, 40)
    : Math.max(editable.fontSize * zoom * 8, 160)
  const height = isCallout
    ? Math.max((editable.height - CALLOUT_PADDING * 2) * zoom, 24)
    : Math.max(editable.fontSize * zoom * 1.6, 28)
  const color = isCallout
    ? resolveColor(contrastTextColor(editable.color))
    : resolveColor(editable.color)

  const commit = (): void => {
    if (committedRef.current) return
    committedRef.current = true
    commitText(editable.id, value)
  }

  return (
    <textarea
      ref={ref}
      className={styles.textOverlay}
      style={{
        left,
        top,
        width,
        height,
        fontSize: editable.fontSize * zoom,
        fontFamily: CANVAS_FONT,
        fontWeight: 600,
        color,
        textAlign: isCallout ? 'center' : 'left',
        transform: editable.rotation ? `rotate(${editable.rotation}deg)` : undefined,
        transformOrigin: 'top left'
      }}
      value={value}
      placeholder={translate('텍스트를 입력해 주세요')}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          commit()
        }
      }}
    />
  )
}
