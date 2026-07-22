/** 보관함 그리드 카드 — 썸네일/메타/태그 + hover 액션. 소유자: Library. */
import type { JSX } from 'react'
import type { LibraryItem } from '@shared/ipc'
import styles from './library.module.css'
import { fileName, relativeTime, toSnaplyFileUrl } from './format'
import { CopyIcon, EditIcon, FolderIcon, OpenFolderIcon, PinIcon, StarIcon, TrashIcon } from './icons'

export interface ItemCardProps {
  item: LibraryItem
  onTogglePin: (item: LibraryItem) => void
  onToggleFavorite: (item: LibraryItem) => void
  onEdit: (item: LibraryItem) => void
  onCopy: (item: LibraryItem) => void
  onMove: (item: LibraryItem) => void
  onShowInFolder: (item: LibraryItem) => void
  onDelete: (item: LibraryItem) => void
}

const MAX_CHIPS = 3

export function ItemCard({
  item,
  onTogglePin,
  onToggleFavorite,
  onEdit,
  onCopy,
  onMove,
  onShowInFolder,
  onDelete
}: ItemCardProps): JSX.Element {
  const thumbUrl = toSnaplyFileUrl(item.thumbPath ?? item.filePath)
  const chips = item.tags.slice(0, MAX_CHIPS)
  const extra = item.tags.length - chips.length

  return (
    <div className={styles.card}>
      <div className={styles.thumbWrap}>
        <img className={styles.thumb} src={thumbUrl} alt={fileName(item.filePath)} loading="lazy" />

        <div className={styles.toggles}>
          <button
            type="button"
            className={[styles.toggleBtn, item.pinned ? `${styles.toggleOn} ${styles.togglePinOn}` : '']
              .filter(Boolean)
              .join(' ')}
            title={item.pinned ? '핀 해제해요' : '핀 고정해요'}
            aria-label={item.pinned ? '핀 해제' : '핀 고정'}
            onClick={() => onTogglePin(item)}
          >
            <PinIcon size={15} filled={item.pinned} />
          </button>
          <button
            type="button"
            className={[styles.toggleBtn, item.favorite ? `${styles.toggleOn} ${styles.toggleFavOn}` : '']
              .filter(Boolean)
              .join(' ')}
            title={item.favorite ? '즐겨찾기 해제해요' : '즐겨찾기에 추가해요'}
            aria-label={item.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            onClick={() => onToggleFavorite(item)}
          >
            <StarIcon size={15} filled={item.favorite} />
          </button>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.actionBtn} title="편집해요" onClick={() => onEdit(item)}>
            <EditIcon size={15} />
          </button>
          <button type="button" className={styles.actionBtn} title="클립보드에 복사해요" onClick={() => onCopy(item)}>
            <CopyIcon size={15} />
          </button>
          <button type="button" className={styles.actionBtn} title="폴더로 이동해요" onClick={() => onMove(item)}>
            <FolderIcon size={15} />
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            title="파일 위치를 열어요"
            onClick={() => onShowInFolder(item)}
          >
            <OpenFolderIcon size={15} />
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            title="삭제해요"
            onClick={() => onDelete(item)}
          >
            <TrashIcon size={15} />
          </button>
        </div>
      </div>

      <div className={styles.cardBody}>
        <span className={styles.cardName} title={item.filePath}>
          {fileName(item.filePath)}
        </span>
        <span className={styles.cardTime}>
          {relativeTime(item.createdAt)} · {item.width}×{item.height}
        </span>
        {chips.length > 0 && (
          <div className={styles.chips}>
            {chips.map((tag) => (
              <span key={tag} className={styles.chip}>
                {tag}
              </span>
            ))}
            {extra > 0 && <span className={styles.chip}>+{extra}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
