/** 보관함 그리드 카드 — 썸네일/메타/태그 + hover 액션 + 다중 선택. 소유자: Library. */
import type { JSX, MouseEvent } from 'react'
import type { LibraryItem } from '@shared/ipc'
import styles from './library.module.css'
import { fileName, relativeTime, toSnaplyFileUrl } from './format'
import {
  CheckIcon,
  CopyIcon,
  EditIcon,
  FilmIcon,
  FolderIcon,
  OpenFolderIcon,
  PinIcon,
  PlayIcon,
  StarIcon,
  TextScanIcon,
  TrashIcon
} from './icons'

export interface ItemCardProps {
  item: LibraryItem
  onTogglePin: (item: LibraryItem) => void
  onToggleFavorite: (item: LibraryItem) => void
  onEdit: (item: LibraryItem) => void
  onCopy: (item: LibraryItem) => void
  onMove: (item: LibraryItem) => void
  onShowInFolder: (item: LibraryItem) => void
  onDelete: (item: LibraryItem) => void
  onGrabText: (item: LibraryItem) => void
  /** 다중 선택 모드 */
  selectMode?: boolean
  selected?: boolean
  onSelectToggle?: (item: LibraryItem, shiftKey: boolean) => void
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
  onDelete,
  onGrabText,
  selectMode = false,
  selected = false,
  onSelectToggle
}: ItemCardProps): JSX.Element {
  const isImage = item.kind === 'image'
  // video는 썸네일이 없으면 파일 자체를 <img>로 못 그리므로 플레이스홀더로 대체
  const thumbSrc = item.thumbPath ?? (isImage || item.kind === 'gif' ? item.filePath : undefined)
  const chips = item.tags.slice(0, MAX_CHIPS)
  const extra = item.tags.length - chips.length

  const handleCardClick = (event: MouseEvent): void => {
    if (selectMode) onSelectToggle?.(item, event.shiftKey)
  }

  return (
    <div
      className={[styles.card, selectMode ? styles.cardSelectable : '', selected ? styles.cardSelected : '']
        .filter(Boolean)
        .join(' ')}
      onClick={handleCardClick}
    >
      <div className={styles.thumbWrap}>
        {thumbSrc ? (
          <img className={styles.thumb} src={toSnaplyFileUrl(thumbSrc)} alt={fileName(item.filePath)} loading="lazy" />
        ) : (
          <div className={styles.videoPlaceholder} aria-hidden="true">
            <FilmIcon size={32} />
          </div>
        )}

        {/* video/gif: 재생 아이콘 오버레이 — 클릭 시 파일 위치 열기 */}
        {!isImage && !selectMode && (
          <button
            type="button"
            className={styles.playOverlay}
            title="파일 위치를 열어요"
            aria-label="파일 위치 열기"
            onClick={() => onShowInFolder(item)}
          >
            <span className={styles.playBadge}>
              <PlayIcon size={22} />
            </span>
          </button>
        )}

        {selectMode ? (
          <span
            className={[styles.selectCheck, selected ? styles.selectCheckOn : ''].filter(Boolean).join(' ')}
            aria-hidden="true"
          >
            {selected && <CheckIcon size={13} />}
          </span>
        ) : (
          <>
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
              {isImage && (
                <>
                  <button type="button" className={styles.actionBtn} title="편집해요" onClick={() => onEdit(item)}>
                    <EditIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    title="텍스트를 추출해요"
                    onClick={() => onGrabText(item)}
                  >
                    <TextScanIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    title="클립보드에 복사해요"
                    onClick={() => onCopy(item)}
                  >
                    <CopyIcon size={15} />
                  </button>
                </>
              )}
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
          </>
        )}
      </div>

      <div className={styles.cardBody}>
        <span className={styles.cardName} title={item.filePath}>
          {fileName(item.filePath)}
        </span>
        <span className={styles.cardTime}>
          {relativeTime(item.createdAt)}
          {item.width > 0 && item.height > 0 ? ` · ${item.width}×${item.height}` : ''}
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
