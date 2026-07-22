/**
 * Konva Stage 전역 레지스트리 + PNG 평탄화. 소유자: Editor.
 * Stage 인스턴스는 직렬화 불가라 스토어 밖에서 관리한다.
 */
import type Konva from 'konva'

export const stageRegistry: {
  stage: Konva.Stage | null
  /** Transformer·크롭 오버레이 등 내보내기에서 제외할 레이어 */
  uiLayer: Konva.Layer | null
} = {
  stage: null,
  uiLayer: null
}

/**
 * 현재 문서를 PNG dataURL로 평탄화한다.
 * 문서 좌표계 = 원본 픽셀 좌표계이므로 pixelRatio 1로 원본 해상도가 유지된다.
 * 줌/팬/뷰포트 크기와 무관하게 (0,0)~(docWidth,docHeight)를 렌더한다.
 * padding > 0이면 문서 주변 여백까지 포함한다 (그림자 효과가 잘리지 않도록).
 */
export function flattenToDataUrl(
  docWidth: number,
  docHeight: number,
  padding = 0
): string | null {
  const stage = stageRegistry.stage
  if (!stage || docWidth <= 0 || docHeight <= 0) return null

  const ui = stageRegistry.uiLayer
  const prevScale = { x: stage.scaleX(), y: stage.scaleY() }
  const prevPos = { x: stage.x(), y: stage.y() }
  const prevSize = { width: stage.width(), height: stage.height() }
  const uiWasVisible = ui?.visible() ?? false
  const outW = docWidth + padding * 2
  const outH = docHeight + padding * 2

  try {
    ui?.visible(false)
    stage.scale({ x: 1, y: 1 })
    stage.position({ x: padding, y: padding })
    stage.size({ width: outW, height: outH })
    return stage.toDataURL({
      x: 0,
      y: 0,
      width: outW,
      height: outH,
      pixelRatio: 1,
      mimeType: 'image/png'
    })
  } finally {
    stage.scale(prevScale)
    stage.position(prevPos)
    stage.size(prevSize)
    if (ui && uiWasVisible) ui.visible(true)
    stage.batchDraw()
  }
}
