/**
 * 주석 객체 → Konva 노드 렌더러. 소유자: Editor.
 */
import type { JSX } from 'react'
import { Arrow, Circle, Ellipse, Group, Line, Rect, Shape, Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useEditorStore } from './store'
import { CANVAS_FONT, contrastTextColor, resolveColor } from './palette'
import { bakeTransform, CALLOUT_PADDING, CALLOUT_RADIUS, HIGHLIGHT_OPACITY } from './objects'
import type { AnnoObject, CalloutObj } from './types'

interface Props {
  obj: AnnoObject
  /** 선택 도구일 때만 true — 클릭 선택/드래그/변형 허용 */
  interactive: boolean
}

/** 말풍선 몸통(라운드 사각형) + 꼬리를 한 패스로 그린다 */
function calloutSceneFunc(obj: CalloutObj): (ctx: Konva.Context, shape: Konva.Shape) => void {
  return (ctx, shape) => {
    const w = Math.max(obj.width, 8)
    const h = Math.max(obj.height, 8)
    const r = Math.min(CALLOUT_RADIUS, w / 2, h / 2)
    ctx.beginPath()
    // 라운드 사각형
    ctx.moveTo(r, 0)
    ctx.lineTo(w - r, 0)
    ctx.arcTo(w, 0, w, r, r)
    ctx.lineTo(w, h - r)
    ctx.arcTo(w, h, w - r, h, r)
    ctx.lineTo(r, h)
    ctx.arcTo(0, h, 0, h - r, r)
    ctx.lineTo(0, r)
    ctx.arcTo(0, 0, r, 0, r)
    ctx.closePath()
    // 꼬리 (몸통에서 가장 가까운 변 기준 삼각형)
    const tx = obj.tailX
    const ty = obj.tailY
    const baseHalf = Math.min(10, w / 4)
    const cx = Math.max(r + baseHalf, Math.min(w - r - baseHalf, tx))
    if (ty >= h) {
      ctx.moveTo(cx - baseHalf, h - 1)
      ctx.lineTo(tx, ty)
      ctx.lineTo(cx + baseHalf, h - 1)
    } else if (ty <= 0) {
      ctx.moveTo(cx - baseHalf, 1)
      ctx.lineTo(tx, ty)
      ctx.lineTo(cx + baseHalf, 1)
    } else {
      const cy = Math.max(r + baseHalf, Math.min(h - r - baseHalf, ty))
      if (tx >= w) {
        ctx.moveTo(w - 1, cy - baseHalf)
        ctx.lineTo(tx, ty)
        ctx.lineTo(w - 1, cy + baseHalf)
      } else {
        ctx.moveTo(1, cy - baseHalf)
        ctx.lineTo(tx, ty)
        ctx.lineTo(1, cy + baseHalf)
      }
    }
    ctx.closePath()
    ctx.fillStrokeShape(shape)
  }
}

export function AnnotationNode({ obj, interactive }: Props): JSX.Element {
  const select = useEditorStore((s) => s.select)
  const toggleSelect = useEditorStore((s) => s.toggleSelect)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const updateObject = useEditorStore((s) => s.updateObject)
  const setEditingText = useEditorStore((s) => s.setEditingText)
  const editingTextId = useEditorStore((s) => s.editingTextId)

  const color = resolveColor(obj.color)
  const isEditing = editingTextId === obj.id

  const handleClick = (e: KonvaEventObject<MouseEvent> | KonvaEventObject<TouchEvent>): void => {
    if (!interactive) return
    if (e.evt.shiftKey) toggleSelect(obj.id)
    else select([obj.id])
  }

  const handleDragStart = (): void => {
    if (!selectedIds.includes(obj.id)) select([obj.id])
  }

  const handleDragEnd = (e: KonvaEventObject<DragEvent>): void => {
    const node = e.target
    updateObject(obj.id, (o) => ({ ...o, x: node.x(), y: node.y() }))
  }

  const handleTransformEnd = (e: KonvaEventObject<Event>): void => {
    const node = e.target
    const t = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY()
    }
    node.scaleX(1)
    node.scaleY(1)
    updateObject(obj.id, (o) => bakeTransform(o, t))
  }

  const common = {
    id: obj.id,
    x: obj.x,
    y: obj.y,
    rotation: obj.rotation,
    draggable: interactive,
    listening: interactive,
    onClick: handleClick,
    onTap: handleClick,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd
  }

  switch (obj.type) {
    case 'arrow':
      return (
        <Arrow
          {...common}
          points={obj.points}
          stroke={color}
          fill={color}
          strokeWidth={obj.strokeWidth}
          pointerLength={obj.headSize}
          pointerWidth={obj.headSize}
          hitStrokeWidth={Math.max(obj.strokeWidth, 14)}
          lineCap="round"
        />
      )
    case 'line':
      return (
        <Line
          {...common}
          points={obj.points}
          stroke={color}
          strokeWidth={obj.strokeWidth}
          hitStrokeWidth={Math.max(obj.strokeWidth, 14)}
          lineCap="round"
        />
      )
    case 'rect':
      return (
        <Rect
          {...common}
          width={obj.width}
          height={obj.height}
          stroke={color}
          strokeWidth={obj.strokeWidth}
          fill={obj.fillEnabled ? color : undefined}
          cornerRadius={2}
        />
      )
    case 'ellipse':
      return (
        <Ellipse
          {...common}
          offsetX={-obj.width / 2}
          offsetY={-obj.height / 2}
          radiusX={Math.max(obj.width / 2, 1)}
          radiusY={Math.max(obj.height / 2, 1)}
          stroke={color}
          strokeWidth={obj.strokeWidth}
          fill={obj.fillEnabled ? color : undefined}
        />
      )
    case 'text':
      return (
        <Text
          {...common}
          text={obj.text || ' '}
          fontSize={obj.fontSize}
          fontFamily={CANVAS_FONT}
          fontStyle="600"
          fill={color}
          visible={!isEditing}
          onDblClick={() => interactive && setEditingText(obj.id)}
          onDblTap={() => interactive && setEditingText(obj.id)}
        />
      )
    case 'callout': {
      const textColor = resolveColor(contrastTextColor(obj.color))
      return (
        <Group
          {...common}
          onDblClick={() => interactive && setEditingText(obj.id)}
          onDblTap={() => interactive && setEditingText(obj.id)}
        >
          <Shape sceneFunc={calloutSceneFunc(obj)} fill={color} />
          <Text
            text={obj.text}
            visible={!isEditing}
            x={CALLOUT_PADDING}
            y={CALLOUT_PADDING}
            width={Math.max(obj.width - CALLOUT_PADDING * 2, 4)}
            height={Math.max(obj.height - CALLOUT_PADDING * 2, 4)}
            fontSize={obj.fontSize}
            fontFamily={CANVAS_FONT}
            fontStyle="600"
            fill={textColor}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )
    }
    case 'highlight':
      return (
        <Line
          {...common}
          points={obj.points}
          stroke={color}
          strokeWidth={obj.strokeWidth}
          opacity={HIGHLIGHT_OPACITY}
          globalCompositeOperation="multiply"
          lineCap="round"
          lineJoin="round"
          tension={0.3}
          hitStrokeWidth={Math.max(obj.strokeWidth, 16)}
        />
      )
    case 'pen':
      return (
        <Line
          {...common}
          points={obj.points}
          stroke={color}
          strokeWidth={obj.strokeWidth}
          lineCap="round"
          lineJoin="round"
          tension={0.4}
          hitStrokeWidth={Math.max(obj.strokeWidth, 14)}
        />
      )
    case 'step': {
      const textColor = resolveColor(contrastTextColor(obj.color))
      return (
        <Group {...common}>
          <Circle radius={obj.radius} fill={color} shadowColor="rgba(0,0,0,0.25)" shadowBlur={4} shadowOffsetY={1} />
          <Text
            text={String(obj.value)}
            x={-obj.radius}
            y={-obj.radius}
            width={obj.radius * 2}
            height={obj.radius * 2}
            align="center"
            verticalAlign="middle"
            fontSize={obj.radius * 1.15}
            fontFamily={CANVAS_FONT}
            fontStyle="700"
            fill={textColor}
            listening={false}
          />
        </Group>
      )
    }
    default:
      return <></>
  }
}
