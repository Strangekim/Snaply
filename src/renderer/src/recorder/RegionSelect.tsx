/**
 * 간이 영역 드래그 선택 — recorder 창 자체를 투명 풀스크린으로 확장한 상태에서 동작.
 * (오버레이 창 사용 금지 제약에 따른 자체 구현. 창이 대상 디스플레이 bounds를 정확히 덮으므로
 * 클라이언트 좌표 = 디스플레이 로컬 DIP 좌표다)
 * 소유자: Recorder
 */
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { RegionRect } from '@shared/ipc'
import styles from './recorder.module.css'

interface RegionSelectProps {
  displayId: number
  onDone: (region: RegionRect) => void
  onCancel: () => void
}

interface DragState {
  startX: number
  startY: number
  x: number
  y: number
}

const MIN_SIZE = 16

function toRect(drag: DragState): { x: number; y: number; width: number; height: number } {
  const x = Math.min(drag.startX, drag.x)
  const y = Math.min(drag.startY, drag.y)
  return {
    x,
    y,
    width: Math.abs(drag.x - drag.startX),
    height: Math.abs(drag.y - drag.startY)
  }
}

export function RegionSelect({ displayId, onDone, onCancel }: RegionSelectProps): JSX.Element {
  const [drag, setDrag] = useState<DragState | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setDrag({ startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drag) return
      setDrag({ ...drag, x: e.clientX, y: e.clientY })
    },
    [drag]
  )

  const handleMouseUp = useCallback(() => {
    if (!drag) return
    const rect = toRect(drag)
    setDrag(null)
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return
    onDone({ ...rect, displayId })
  }, [drag, displayId, onDone])

  const rect = drag ? toRect(drag) : null

  return (
    <div
      className={styles.selectRoot}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {!rect && <div className={styles.selectDim} />}
      {rect && (
        <div
          className={styles.selectionBox}
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        >
          <div
            className={styles.selectionSize}
            style={rect.y > 34 ? { top: -30, left: 0 } : { top: rect.height + 6, left: 0 }}
          >
            {rect.width} × {rect.height}
          </div>
        </div>
      )}
      <div className={styles.selectHint}>드래그해서 녹화할 영역을 선택해 주세요 · ESC 취소</div>
    </div>
  )
}
