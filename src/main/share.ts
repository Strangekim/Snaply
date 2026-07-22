/**
 * 공유 플러그인 시스템. 소유자: Architect-P4.
 * ShareTarget 배열에 항목을 추가하는 것만으로 새 공유 대상을 붙일 수 있는 구조.
 * 1차 구현: 다른 이름으로 저장 / 클립보드 / 이메일. Slack·Google Drive는 stub(comingSoon).
 */
import { clipboard, dialog, nativeImage, shell } from 'electron'
import { copyFileSync } from 'fs'
import { basename, extname } from 'path'
import { handle } from './typedIpc'

export interface ShareRunResult {
  ok: boolean
  message?: string
}

/** 공유 대상 플러그인 인터페이스 — run은 공유할 파일의 절대 경로를 받는다 */
export interface ShareTarget {
  id: string
  label: string
  /** 현재 환경에서 실행 가능한지 (플랫폼/의존성 체크용) */
  available: boolean
  /** 아직 준비 중인 항목 — UI에서 비활성 + '준비 중' 뱃지 */
  comingSoon?: boolean
  run(filePath: string): Promise<ShareRunResult> | ShareRunResult
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])

const targets: ShareTarget[] = [
  {
    id: 'save-as',
    label: '다른 이름으로 저장',
    available: true,
    async run(filePath) {
      const ext = extname(filePath).replace('.', '') || 'png'
      const { canceled, filePath: target } = await dialog.showSaveDialog({
        title: '다른 이름으로 저장',
        defaultPath: basename(filePath),
        filters: [{ name: `${ext.toUpperCase()} 파일`, extensions: [ext] }]
      })
      if (canceled || !target) return { ok: false, message: '저장을 취소했어요' }
      copyFileSync(filePath, target)
      return { ok: true, message: '저장했어요' }
    }
  },
  {
    id: 'clipboard',
    label: '클립보드에 복사',
    available: true,
    run(filePath) {
      if (!IMAGE_EXTS.has(extname(filePath).toLowerCase())) {
        return { ok: false, message: '이미지만 클립보드에 복사할 수 있어요' }
      }
      const img = nativeImage.createFromPath(filePath)
      if (img.isEmpty()) return { ok: false, message: '이미지를 불러오지 못했어요' }
      clipboard.writeImage(img)
      return { ok: true, message: '클립보드에 복사했어요' }
    }
  },
  {
    id: 'email',
    label: '이메일로 보내기',
    available: true,
    async run(filePath) {
      const subject = encodeURIComponent(`Snaply 캡처 — ${basename(filePath)}`)
      const body = encodeURIComponent(
        `Snaply로 캡처한 파일을 공유해요.\n\n파일: ${filePath}\n(파일 위치가 함께 열려요. 메일에 끌어다 놓아 첨부해 주세요.)`
      )
      await shell.openExternal(`mailto:?subject=${subject}&body=${body}`)
      // mailto:는 첨부를 지원하지 않으므로 파일 위치를 열어 드래그 첨부를 유도한다
      shell.showItemInFolder(filePath)
      return { ok: true, message: '메일 앱을 열었어요' }
    }
  },
  {
    id: 'slack',
    label: 'Slack',
    available: false,
    comingSoon: true,
    run() {
      return { ok: false, message: '아직 준비 중이에요' }
    }
  },
  {
    id: 'gdrive',
    label: 'Google Drive',
    available: false,
    comingSoon: true,
    run() {
      return { ok: false, message: '아직 준비 중이에요' }
    }
  }
]

/** 라이브러리 항목 id → 파일 경로 (동적 import — export.ts와 동일 패턴) */
async function resolveItemPath(itemId: string): Promise<string> {
  const { getItem } = await import('./library/db')
  const item = getItem(itemId)
  if (!item) throw new Error('항목을 찾지 못했어요.')
  return item.filePath
}

export function registerShareIpc(): void {
  handle('share:targets', () =>
    targets.map(({ id, label, available, comingSoon }) => ({ id, label, available, comingSoon }))
  )

  handle('share:run', async ({ targetId, itemId, filePath }) => {
    const target = targets.find((t) => t.id === targetId)
    if (!target) return { ok: false, message: '알 수 없는 공유 대상이에요' }
    const path = filePath ?? (itemId ? await resolveItemPath(itemId) : null)
    if (!path) return { ok: false, message: '공유할 파일이 없어요' }
    try {
      return await target.run(path)
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '공유하지 못했어요' }
    }
  })
}
