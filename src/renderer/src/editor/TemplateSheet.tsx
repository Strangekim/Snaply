/**
 * 템플릿 선택 시트 — 비교/튜토리얼/타임라인 새 문서 생성. 소유자: Editor.
 */
import type { JSX } from 'react'
import { BottomSheet, SheetItem, useToast } from '@ds/index'
import { useEditorStore } from './store'
import { buildTemplate, makeSolidBackground, type TemplateKind } from './templates'

const TEMPLATES: Array<{ kind: TemplateKind; title: string; description: string; icon: string }> = [
  { kind: 'compare', title: '비교', description: 'Before / After 2분할 + 라벨', icon: '⇄' },
  { kind: 'tutorial', title: '튜토리얼', description: '세로 3단계 + 번호 뱃지', icon: '≡' },
  { kind: 'timeline', title: '타임라인', description: '가로 3칸 + 화살표', icon: '→' }
]

export function TemplateSheet(): JSX.Element {
  const { toast } = useToast()
  const open = useEditorStore((s) => s.sheet === 'templates')
  const setSheet = useEditorStore((s) => s.setSheet)
  const openGeneratedDoc = useEditorStore((s) => s.openGeneratedDoc)

  const create = (kind: TemplateKind): void => {
    const t = buildTemplate(kind)
    const imageUrl = makeSolidBackground(t.width, t.height, t.bgToken)
    openGeneratedDoc({
      fileName: t.fileName,
      imageUrl,
      width: t.width,
      height: t.height,
      objects: t.objects,
      stepCounter: t.stepCounter
    })
    setSheet(null)
    toast('템플릿을 만들었어요. 프레임을 선택하고 Ctrl+V로 이미지를 붙여넣어 보세요')
  }

  return (
    <BottomSheet open={open} onClose={() => setSheet(null)} title="템플릿으로 새 문서">
      {TEMPLATES.map((t) => (
        <SheetItem
          key={t.kind}
          icon={<span aria-hidden>{t.icon}</span>}
          title={t.title}
          description={t.description}
          onClick={() => create(t.kind)}
        />
      ))}
    </BottomSheet>
  )
}
