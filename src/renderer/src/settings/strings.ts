/** 설정 화면 문구 사전 — i18n 인프라 시범 적용.
 * TODO(i18n): 다른 화면들도 이 패턴으로 옮기고 en 사전을 채운다 */
export type Locale = 'ko' | 'en'

const ko = {
  title: '설정',
  sectionHotkeys: '단축키',
  hkAllInOne: '캡처하기 (All-in-One)',
  hkRegion: '영역 캡처',
  hkFullscreen: '전체 화면 캡처',
  hkWindow: '창 캡처',
  hkRecord: '화면 녹화',
  sectionSave: '저장',
  savePath: '저장 폴더',
  changeFolder: '변경하기',
  filenamePattern: '파일명 규칙',
  filenameHint: '{yyyy} {MM} {dd} {HH} {mm} {ss} 토큰을 쓸 수 있어요',
  preview: '미리보기',
  sectionCapture: '캡처',
  afterCapture: '캡처 후 동작',
  afterEditor: '에디터 열기',
  afterClipboard: '클립보드 복사',
  afterQuick: '빠른 주석',
  sectionApp: '앱',
  language: '언어',
  theme: '테마',
  themeSystem: '시스템',
  themeLight: '라이트',
  themeDark: '다크',
  autoStart: '로그인할 때 자동으로 시작',
  autoStartDesc: 'PC를 켜면 Snaply가 트레이에서 기다려요',
  permissionTitle: '화면 기록 권한이 필요해요',
  permissionDesc:
    '시스템 설정 > 개인정보 보호 및 보안 > 화면 기록에서 Snaply를 허용해 주세요. 허용하지 않으면 캡처가 검은 화면으로 나와요.',
  saved: '저장했어요',
  supportTitle: 'Snaply가 마음에 드셨나요?',
  supportDesc: 'Snaply는 무료 오픈소스예요. 커피 한 잔이 다음 업데이트를 만들어요.',
  supportButton: '☕ 커피 한 잔 사주기'
}

/* TODO(i18n): 영어 사전 초안 — 설정 화면부터 시범 적용 */
const en: typeof ko = {
  title: 'Settings',
  sectionHotkeys: 'Shortcuts',
  hkAllInOne: 'Capture (All-in-One)',
  hkRegion: 'Region capture',
  hkFullscreen: 'Full screen capture',
  hkWindow: 'Window capture',
  hkRecord: 'Screen recording',
  sectionSave: 'Saving',
  savePath: 'Save folder',
  changeFolder: 'Change',
  filenamePattern: 'File name pattern',
  filenameHint: 'Tokens: {yyyy} {MM} {dd} {HH} {mm} {ss}',
  preview: 'Preview',
  sectionCapture: 'Capture',
  afterCapture: 'After capture',
  afterEditor: 'Open editor',
  afterClipboard: 'Copy to clipboard',
  afterQuick: 'Quick annotate',
  sectionApp: 'App',
  language: 'Language',
  theme: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  autoStart: 'Start at login',
  autoStartDesc: 'Snaply waits in the tray when your PC starts',
  permissionTitle: 'Screen recording permission needed',
  permissionDesc:
    'Allow Snaply in System Settings > Privacy & Security > Screen Recording, or captures will be black.',
  saved: 'Saved',
  supportTitle: 'Enjoying Snaply?',
  supportDesc: 'Snaply is free and open source. A coffee fuels the next update.',
  supportButton: '☕ Buy me a coffee'
}

export const STRINGS: Record<Locale, typeof ko> = { ko, en }
