/**
 * Snaply 경량 i18n — 한국어 원문을 키로 쓰고, en은 번역 맵에서 찾는다.
 * 번역이 없으면 한국어로 폴백(안전). 소유자: Architect.
 *
 * 사용법:
 *   const { t } = useI18n()
 *   t('캡처했어요')                       → 'Captured' (en)
 *   t('{n}개 선택됨', { n: 3 })          → '3 selected'
 */
import { useSyncExternalStore } from 'react'

export type Locale = 'ko' | 'en'

let locale: Locale = 'ko'
const listeners = new Set<() => void>()

function setLocale(next: Locale): void {
  if (next === locale) return
  locale = next
  for (const l of listeners) l()
}

let initialized = false
/** 각 창의 엔트리에서 1회 호출 — 설정을 읽고 변경을 구독한다 */
export function initI18n(): void {
  if (initialized || typeof window === 'undefined' || !window.snaply) return
  initialized = true
  void window.snaply.invoke('settings:get', undefined).then((s) => setLocale(s.language))
  window.snaply.on('event:settingsChanged', (s) => setLocale(s.language))
}

export function getLocale(): Locale {
  return locale
}

export function translate(ko: string, vars?: Record<string, string | number>): string {
  let out = locale === 'ko' ? ko : (EN[ko] ?? ko)
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
  }
  return out
}

export function useI18n(): { t: typeof translate; locale: Locale } {
  const current = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => locale
  )
  return { t: translate, locale: current }
}

/** 한국어 원문 → 영어 번역 맵 */
const EN: Record<string, string> = {
  // ── 공통 ──
  '캡처했어요': 'Captured',
  '저장했어요': 'Saved',
  '복사했어요': 'Copied',
  '삭제했어요': 'Deleted',
  '내보냈어요': 'Exported',
  '취소해요': 'Cancel',
  '삭제해요': 'Delete',
  '만들어요': 'Create',
  '내보내요': 'Export',
  '캡처하기': 'Capture',
  '내보내기': 'Export',
  '공유해요': 'Share',
  '내보내요, 실패': 'Export failed',
  '내보내지 못했어요': 'Could not export',
  '복사하지 못했어요': 'Could not copy',
  '삭제하지 못했어요': 'Could not delete',
  '공유하지 못했어요': 'Could not share',
  '불러오는 중이에요...': 'Loading...',
  '준비 중이에요': 'Coming soon',

  // ── 보관함 ──
  '보관함': 'Library',
  '전체': 'All',
  '즐겨찾기': 'Favorites',
  '핀 고정': 'Pinned',
  '폴더': 'Folders',
  '설정': 'Settings',
  '그리드': 'Grid',
  '타임라인': 'Timeline',
  '선택': 'Select',
  '선택 끝내기': 'Done',
  '최근 캡처': 'Recent captures',
  '모든 캡처': 'All captures',
  '오늘': 'Today',
  '어제': 'Yesterday',
  '방금 전': 'Just now',
  '{n}분 전': '{n}m ago',
  '{n}시간 전': '{n}h ago',
  '{n}일 전': '{n}d ago',
  '파일명, 태그, 추출한 텍스트로 검색해요': 'Search by name, tag, or extracted text',
  '보관함 검색': 'Search library',
  '검색 결과가 없어요': 'No results',
  '다른 검색어로 다시 찾아보세요.': 'Try a different search.',
  '아직 캡처가 없어요': 'No captures yet',
  '캡처하기 버튼이나 단축키로 첫 캡처를 시작해 보세요.': 'Press the capture button or hotkey to get started.',
  '{n}개 선택됨': '{n} selected',
  '일괄 내보내기': 'Batch export',
  '{n}개를 일괄 내보내요': 'Export {n} items',
  '{n}개를 내보냈어요': 'Exported {n} items',
  '리사이즈 폭 (px)': 'Resize width (px)',
  '비워 두면 원본 크기 그대로예요': 'Leave empty to keep original size',
  '포맷': 'Format',
  '워터마크 텍스트': 'Watermark text',
  '비워 두면 워터마크 없이 내보내요': 'Leave empty for no watermark',
  '폴더로 이동해요': 'Move to folder',
  '폴더 없음': 'No folder',
  '폴더에서 꺼내요': 'Remove from folder',
  '폴더에서 꺼냈어요': 'Removed from folder',
  '폴더로 옮겼어요': 'Moved to folder',
  '아직 폴더가 없어요. 사이드바에서 폴더를 먼저 만들어 주세요.': 'No folders yet. Create one in the sidebar first.',
  '캡처를 삭제할까요?': 'Delete this capture?',
  "'{name}' 파일도 함께 삭제돼요. 되돌릴 수 없어요.": "The file '{name}' will also be deleted. This cannot be undone.",
  '새 폴더를 만들어요': 'Create a folder',
  '폴더 이름': 'Folder name',
  '예: 업무 스크린샷': 'e.g. Work screenshots',
  '폴더 이름을 입력해 주세요': 'Enter a folder name',
  '폴더를 만들었어요': 'Folder created',
  '폴더를 만들지 못했어요': 'Could not create folder',
  '폴더를 삭제할까요?': 'Delete this folder?',
  "'{name}' 폴더만 삭제되고, 안의 캡처는 전체 목록에 남아요.":
    "Only the folder '{name}' is deleted. Its captures stay in All.",
  '폴더를 삭제했어요': 'Folder deleted',
  '폴더를 추가해요': 'Add folder',
  '추출한 텍스트': 'Extracted text',
  '텍스트를 인식하고 있어요…': 'Recognizing text…',
  '인식된 텍스트가 없어요.': 'No text recognized.',
  '텍스트를 추출하지 못했어요. 잠시 후 다시 시도해 주세요.': 'Could not extract text. Try again shortly.',
  '다시 인식해요': 'Recognize again',
  '전체 복사해요': 'Copy all',
  '텍스트를 복사했어요': 'Text copied',
  '어떤 형식으로 내보낼까요?': 'Choose a format',
  '문서로 보관하기 좋아요': 'Great for documents',
  '슬라이드로 바로 편집할 수 있어요': 'Edit right away as slides',
  '용량이 작아요': 'Smaller file size',
  '어디로 공유할까요?': 'Share to…',
  '다른 이름으로 저장': 'Save as…',
  '클립보드에 복사': 'Copy to clipboard',
  '이메일로 보내기': 'Send by email',
  '저장을 취소했어요': 'Save cancelled',
  '이미지만 클립보드에 복사할 수 있어요': 'Only images can be copied to the clipboard',
  '메일 앱을 열었어요': 'Opened your mail app',
  '아직 준비 중이에요': 'Coming soon',
  '알 수 없는 공유 대상이에요': 'Unknown share target',
  '공유할 파일이 없어요': 'No file to share',
  '공유 대상을 불러오고 있어요...': 'Loading share targets...',
  '클립보드에 복사했어요': 'Copied to clipboard',
  '편집해요': 'Edit',
  '텍스트를 추출해요': 'Extract text',
  '클립보드에 복사해요': 'Copy to clipboard',
  '파일 위치를 열어요': 'Show in folder',
  '내보내요, 항목': 'Export item',
  '핀 해제해요': 'Unpin',
  '핀 고정해요': 'Pin',
  '핀 해제': 'Unpin',
  '즐겨찾기 해제해요': 'Remove favorite',
  '즐겨찾기에 추가해요': 'Add to favorites',
  '즐겨찾기 해제': 'Remove favorite',
  '즐겨찾기 추가': 'Add favorite',
  '파일 위치 열기': 'Show in folder',
  '보기 방식': 'View mode',
  '내보내기 포맷': 'Export format',

  // ── 에디터 ──
  '캡처 대기 중': 'Waiting for a capture',
  '캡처하면 여기서 편집할 수 있어요': 'Capture something to edit it here',
  '실행 취소': 'Undo',
  '다시 실행': 'Redo',
  '실행 취소 (Ctrl+Z)': 'Undo (Ctrl+Z)',
  '다시 실행 (Ctrl+Shift+Z)': 'Redo (Ctrl+Shift+Z)',
  '복사': 'Copy',
  '저장': 'Save',
  '저장 (Ctrl+S)': 'Save (Ctrl+S)',
  '클립보드로 복사 (Ctrl+Shift+C)': 'Copy to clipboard (Ctrl+Shift+C)',
  '복사에 실패했어요': 'Copy failed',
  '저장에 실패했어요': 'Save failed',
  '이미지를 불러오지 못했어요': 'Could not load the image',
  '민감정보 가리기': 'Redact sensitive info',
  '찾는 중...': 'Scanning...',
  '{n}건 가렸어요': 'Redacted {n} items',
  '민감한 정보를 찾지 못했어요': 'No sensitive info found',
  '민감정보 인식에 실패했어요': 'Redaction scan failed',
  'OCR로 이메일·전화번호·카드번호·주민번호를 찾아 모자이크 처리해요':
    'Finds emails, phone numbers, card and ID numbers via OCR and mosaics them',
  '효과': 'Effects',
  '테두리·그림자·라운드·찢어진 가장자리': 'Border, shadow, rounded corners, torn edge',
  '템플릿': 'Templates',
  '비교·튜토리얼·타임라인 템플릿으로 새 문서': 'New document from Compare, Tutorial, or Timeline templates',
  'PNG·JPG·WebP·PDF·TIFF·PPTX로 내보내요': 'Export as PNG, JPG, WebP, PDF, TIFF, or PPTX',

  // ── 에디터 도구 ──
  '화살표': 'Arrow',
  '직선': 'Line',
  '선': 'Line',
  '타원': 'Ellipse',
  '사각형': 'Rectangle',
  '원': 'Ellipse',
  '텍스트': 'Text',
  '말풍선': 'Callout',
  '형광펜': 'Highlighter',
  '펜': 'Pen',
  '스텝 넘버': 'Step number',
  '블러 · 모자이크': 'Blur · Mosaic',
  '스포트라이트': 'Spotlight',
  '돋보기': 'Magnifier',
  '스탬프': 'Stamp',
  '자르기': 'Crop',

  // ── 에디터 패널/시트 ──
  '잘라내기': 'Crop',
  '번호 초기화': 'Reset numbering',
  '닫기': 'Close',
  '재생': 'Play',
  '시작 지점': 'Start point',
  '끝 지점': 'End point',
  '녹화 데이터를 읽지 못했어요.': 'Could not read the recording data.',
  '모자이크': 'Mosaic',
  '블러': 'Blur',
  '원형': 'Ellipse',
  '색상': 'Color',
  '굵기': 'Thickness',
  '크기': 'Size',
  '글자': 'Font size',
  '머리': 'Head',
  '채우기': 'Fill',
  '모드': 'Mode',
  '강도': 'Intensity',
  '모양': 'Shape',
  '배율': 'Zoom',
  '다음 번호': 'Next number',
  '같은 종류 모두 바꾸기': 'Apply to all of this type',
  '선택한 객체와 같은 종류 전체에 현재 스타일을 적용해요 (undo 한 번으로 되돌릴 수 있어요)':
    'Applies the current style to every object of the same type (one undo reverts it)',
  '남길 영역을 드래그해서 지정해 주세요': 'Drag to choose the area to keep',
  '캔버스를 클릭하면 돋보기가 놓여요': 'Click the canvas to place a magnifier',
  '객체를 선택하거나 드래그로 여러 개를 선택할 수 있어요': 'Click or drag to select objects',
  '이미지 효과': 'Image effects',
  '테두리': 'Border',
  '두께': 'Width',
  '그림자': 'Shadow',
  '모서리 라운드': 'Rounded corners',
  '찢어진 가장자리': 'Torn edge',
  '없음': 'None',
  '위': 'Top',
  '아래': 'Bottom',
  '왼쪽': 'Left',
  '오른쪽': 'Right',
  '스탬프를 고른 뒤 캔버스를 클릭하면 배치돼요': 'Pick a stamp, then click the canvas to place it',
  '템플릿으로 새 문서': 'New document from template',
  '비교': 'Compare',
  '튜토리얼': 'Tutorial',
  'Before / After 2분할 + 라벨': 'Before / After split + labels',
  '세로 3단계 + 번호 뱃지': '3 vertical steps + number badges',
  '가로 3칸 + 화살표': '3 horizontal frames + arrows',
  '템플릿을 만들었어요. 프레임을 선택하고 Ctrl+V로 이미지를 붙여넣어 보세요':
    'Template created. Select a frame and paste an image with Ctrl+V',

  // ── 오버레이 ──
  '영역': 'Region',
  '창': 'Window',
  '전체 화면': 'Full screen',
  '스크롤': 'Scroll',
  '지연 캡처': 'Timed capture',
  '고정 크기로 캡처해요': 'Capture at a fixed size',
  '적용': 'Apply',
  '너비': 'Width',
  '높이': 'Height',
  '{n}초': '{n}s',
  '✕ 취소': '✕ Cancel',
  '드래그해서 캡처할 영역을 선택해 주세요 · ESC 취소': 'Drag to select a region to capture · ESC to cancel',
  '핸들을 끌어 크기를 조정하거나 영역을 이동할 수 있어요 · Enter 캡처 · ESC 취소':
    'Drag the handles to resize or move the region · Enter to capture · ESC to cancel',
  '스크롤 캡처할 영역을 드래그로 선택해 주세요 · 시작하면 자동으로 스크롤돼요 · ESC 취소':
    'Drag over the area to scroll-capture · It scrolls automatically · ESC to cancel',
  '⇊ 스크롤 캡처': '⇊ Scroll capture',
  '✓ 캡처': '✓ Capture',
  '📋 클립보드': '📋 Clipboard',
  '클릭하면 이 화면을 캡처해요': 'Click to capture this screen',
  '주 모니터': 'Primary',
  '디스플레이': 'Display',
  '배율 {n}%': 'Scale {n}%',
  '캡처할 창을 선택해 주세요': 'Pick a window to capture',
  '캡처할 수 있는 창이 없어요': 'No windows to capture',
  '창 목록을 불러오고 있어요…': 'Loading windows…',

  // ── 녹화 ──
  '화면 녹화': 'Screen recording',
  '녹화 대상': 'Target',
  '디스플레이 선택': 'Display',
  '마이크': 'Microphone',
  '시스템 오디오': 'System audio',
  '웹캠': 'Webcam',
  '녹화 시작하기': 'Start recording',
  '일시정지': 'Pause',
  '재개': 'Resume',
  '정지': 'Stop',
  '취소': 'Cancel',
  '다시 찍기': 'Retake',
  '저장하기': 'Save',
  '녹화를 저장하고 있어요...': 'Saving your recording...',
  '확인하고 저장해요': 'Review and save',
  '트리밍': 'Trim',
  '{d} 저장돼요': '{d} will be saved',
  'GIF 프레임레이트': 'GIF frame rate',
  '영역 선택하고 시작': 'Pick a region and start',
  '녹화 시작': 'Start recording',
  '드래그해서 녹화할 영역을 선택해 주세요 · ESC 취소': 'Drag to select the recording area · ESC to cancel',
  '녹화할 영역을 드래그로 선택해 주세요 · ESC 취소': 'Drag to select the recording area · ESC to cancel',
  '화면 스트림을 가져오지 못했어요': 'Could not get the screen stream',
  '녹화를 저장하지 못했어요': 'Could not save the recording',

  // ── 온보딩 ──
  '만나서 반가워요': 'Nice to meet you',
  '단축키 하나면 돼요': 'One hotkey is all you need',
  '권한만 허용하면 끝나요': 'Just allow the permission',
  '준비 끝!': 'All set!',
  '다음': 'Next',
  '시작하기': 'Get started',
  'Snaply는 캡처, 편집, 녹화, 텍스트 추출까지\n한 번에 되는 화면 캡처 앱이에요.':
    'Snaply captures, edits, records,\nand extracts text — all in one app.',
  'Cmd+Shift+9를 누르면 어디서든 캡처가 시작돼요.\n설정에서 언제든 바꿀 수 있어요.':
    'Press Cmd+Shift+9 to capture from anywhere.\nYou can change it in Settings anytime.',
  'PrintScreen 키를 누르면 어디서든 캡처가 시작돼요.\n설정에서 언제든 바꿀 수 있어요.':
    'Press PrintScreen to capture from anywhere.\nYou can change it in Settings anytime.',
  '시스템 설정 > 개인정보 보호 및 보안 > 화면 기록에서\nSnaply를 허용해 주세요. 허용해야 화면이 캡처돼요.':
    'Allow Snaply in System Settings >\nPrivacy & Security > Screen Recording.',
  '캡처한 이미지는 보관함에 자동으로 쌓이고,\n검색으로 언제든 다시 찾을 수 있어요.':
    'Captures pile up in your library automatically,\nand search finds them anytime.'
}
