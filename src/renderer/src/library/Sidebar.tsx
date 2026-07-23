/** 보관함 좌측 사이드바 — 전체/즐겨찾기/핀/폴더 + 설정. 소유자: Library. */
import type { JSX } from 'react'
import { Button } from '@ds/index'
import type { LibraryFolder } from '@shared/ipc'
import styles from './library.module.css'
import type { SidebarFilter } from './useLibrary'
import { useI18n } from '../common/i18n'
import { openSupportPage } from '../common/support'
import { FolderIcon, GridIcon, PinIcon, PlusIcon, SettingsIcon, StarIcon, TrashIcon } from './icons'

export interface SidebarProps {
  filter: SidebarFilter
  folders: LibraryFolder[]
  onSelect: (filter: SidebarFilter) => void
  onAddFolder: () => void
  onDeleteFolder: (folder: LibraryFolder) => void
}

export function Sidebar({ filter, folders, onSelect, onAddFolder, onDeleteFolder }: SidebarProps): JSX.Element {
  const { t } = useI18n()
  const navClass = (active: boolean): string =>
    [styles.navItem, active ? styles.navItemActive : ''].filter(Boolean).join(' ')

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>Snaply</div>

      <nav className={styles.navList} aria-label="보관함 필터">
        <button type="button" className={navClass(filter.type === 'all')} onClick={() => onSelect({ type: 'all' })}>
          <span className={styles.navIcon}>
            <GridIcon size={16} />
          </span>
          <span className={styles.navLabel}>{t('전체')}</span>
        </button>
        <button
          type="button"
          className={navClass(filter.type === 'favorite')}
          onClick={() => onSelect({ type: 'favorite' })}
        >
          <span className={styles.navIcon}>
            <StarIcon size={16} />
          </span>
          <span className={styles.navLabel}>{t('즐겨찾기')}</span>
        </button>
        <button
          type="button"
          className={navClass(filter.type === 'pinned')}
          onClick={() => onSelect({ type: 'pinned' })}
        >
          <span className={styles.navIcon}>
            <PinIcon size={16} />
          </span>
          <span className={styles.navLabel}>{t('핀 고정')}</span>
        </button>
      </nav>

      <div className={styles.sectionTitle}>
        <span>{t('폴더')}</span>
        <button type="button" className={styles.folderAddBtn} title={t('폴더를 추가해요')} onClick={onAddFolder}>
          <PlusIcon size={14} />
        </button>
      </div>

      <nav className={styles.navList} aria-label="폴더 목록">
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            className={navClass(filter.type === 'folder' && filter.folderId === folder.id)}
            onClick={() => onSelect({ type: 'folder', folderId: folder.id })}
          >
            <span className={styles.navIcon}>
              <FolderIcon size={16} />
            </span>
            <span className={styles.navLabel}>{folder.name}</span>
            <span
              role="button"
              tabIndex={-1}
              className={styles.folderDeleteBtn}
              title={t('폴더를 삭제해요')}
              onClick={(event) => {
                event.stopPropagation()
                onDeleteFolder(folder)
              }}
            >
              <TrashIcon size={13} />
            </span>
          </button>
        ))}
        {folders.length === 0 && (
          <div style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
            {t('아직 폴더가 없어요')}
          </div>
        )}
      </nav>

      <div className={styles.sidebarSpacer} />

      <Button variant="ghost" size="sm" fullWidth onClick={openSupportPage}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          ☕ {t('커피 한 잔 사주기')}
        </span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        fullWidth
        onClick={() => void window.snaply.invoke('window:open', { window: 'settings' })}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <SettingsIcon size={15} />
          {t('설정')}
        </span>
      </Button>
    </aside>
  )
}
