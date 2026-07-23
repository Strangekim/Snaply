/**
 * 템플릿 선택 시트 — 비교/튜토리얼/타임라인 새 문서 생성. 소유자: Editor.
 */
import type { JSX } from 'react'
import { BottomSheet, SheetItem, useToast } from '@ds/index'
import { useI18n } from '../common/i18n'
import { useEditorStore } from './store'
import { buildTemplate, makeSolidBackground, type TemplateKind } from './templates'

// 로케일 변경이 반영되도록 렌더 시점에 라벨을 만든다
const templates = (
  t: (ko: string) => string
): Array<{ kind: TemplateKind; title: string; description: string; icon: string }> => [
  { kind: 'compare', title: t('비교'), description: t('Before / After 2분할 + 라벨'), icon: '⇄' },
  { kind: 'tutorial', title: t('튜토리얼'), description: t('세로 3단계 + 번호 뱃지'), icon: '≡' },
  { kind: 'timeline', title: t('타임라인'), description: t('가로 3칸 + 화살표'), icon: '→' },
  { kind: 'grid4', title: t('그리드'), description: t('2×2 스크린샷 모아보기'), icon: '⊞' },
  { kind: 'caption', title: t('캡션 카드'), description: t('큰 이미지 1장 + 제목/설명'), icon: '▭' }
]

export function TemplateSheet(): JSX.Element {
  const { toast } = useToast()
  const { t } = useI18n()
  const open = useEditorStore((s) => s.sheet === 'templates')
  const setSheet = useEditorStore((s) => s.setSheet)
  const openGeneratedDoc = useEditorStore((s) => s.openGeneratedDoc)

  const create = (kind: TemplateKind): void => {
    // 편집 중이던 이미지가 있으면 첫 프레임에 자동으로 넣는다
    const s = useEditorStore.getState()
    const seed = s.imageUrl
      ? { src: s.imageUrl, width: s.imageWidth, height: s.imageHeight }
      : null
    const tpl = buildTemplate(kind, t, seed)
    const imageUrl = makeSolidBackground(tpl.width, tpl.height, tpl.bgToken)
    openGeneratedDoc({
      fileName: tpl.fileName,
      imageUrl,
      width: tpl.width,
      height: tpl.height,
      objects: tpl.objects,
      stepCounter: tpl.stepCounter
    })
    setSheet(null)
    toast(t('템플릿을 만들었어요. 프레임을 선택하고 Ctrl+V로 이미지를 붙여넣어 보세요'))
  }

  return (
    <BottomSheet open={open} onClose={() => setSheet(null)} title={t('템플릿으로 새 문서')}>
      {templates(t).map((tpl) => (
        <SheetItem
          key={tpl.kind}
          icon={<span aria-hidden>{tpl.icon}</span>}
          title={tpl.title}
          description={tpl.description}
          onClick={() => create(tpl.kind)}
        />
      ))}
    </BottomSheet>
  )
}
