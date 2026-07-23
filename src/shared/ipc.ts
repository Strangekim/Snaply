/**
 * Snaply IPC 계약 v1 — 메인↔렌더러 간 모든 통신은 이 파일에 정의된 채널만 사용한다.
 * 소유자: Architect (메인 루프). 다른 에이전트는 읽기 전용.
 */

// ───────────────────────── 공통 타입 ─────────────────────────

export type CaptureMode = 'region' | 'window' | 'fullscreen' | 'scrolling' | 'all-in-one'

export type AfterCaptureAction = 'editor' | 'clipboard' | 'quick-annotate'

export interface DisplayInfo {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
}

export interface CaptureOptions {
  mode: CaptureMode
  /** 지연 캡처 (ms). 0이면 즉시 */
  delayMs?: number
  /** 예약 캡처: epoch ms. delayMs보다 우선 */
  scheduledAt?: number
  /** 멀티 모니터: 대상 디스플레이 id (fullscreen 전용) */
  displayId?: number
  /** 지연 캡처: 이미 지정해 둔 영역 — 카운트다운 후 이 영역을 자동 캡처한다 (region/scrolling) */
  region?: RegionRect
  afterAction?: AfterCaptureAction
}

export interface RegionRect {
  x: number
  y: number
  width: number
  height: number
  displayId: number
}

export interface CaptureResult {
  /** 라이브러리 항목 id (nanoid) */
  id: string
  filePath: string
  width: number
  height: number
  mode: CaptureMode
  createdAt: number
  /** 캡처 대상 앱/창 제목 (창 캡처 시) */
  sourceApp?: string
  sourceTitle?: string
}

// ───────────────────────── 라이브러리 ─────────────────────────

export type ItemKind = 'image' | 'video' | 'gif'

export interface LibraryItem {
  id: string
  filePath: string
  thumbPath?: string
  kind: ItemKind
  mode?: CaptureMode
  width: number
  height: number
  createdAt: number
  sourceApp?: string
  sourceTitle?: string
  tags: string[]
  pinned: boolean
  favorite: boolean
  folderId?: string
  ocrText?: string
  fileSize: number
}

export interface LibraryQuery {
  text?: string
  tags?: string[]
  kind?: ItemKind
  folderId?: string
  favoriteOnly?: boolean
  pinnedOnly?: boolean
  from?: number
  to?: number
  limit?: number
  offset?: number
}

export interface LibraryFolder {
  id: string
  name: string
  createdAt: number
}

// ───────────────────────── 녹화 ─────────────────────────

export interface RecordOptions {
  mode: 'region' | 'fullscreen'
  region?: RegionRect
  displayId?: number
  mic: boolean
  systemAudio: boolean
  webcam: boolean
  format: 'mp4' | 'gif'
  fps?: number
}

export interface RecordResult {
  id: string
  filePath: string
  durationMs: number
  format: 'mp4' | 'gif' | 'webm'
}

// ───────────────────────── 설정 ─────────────────────────

export interface HotkeySettings {
  allInOne: string
  region: string
  fullscreen: string
  window: string
  record: string
}

export interface AppSettings {
  hotkeys: HotkeySettings
  savePath: string
  filenamePattern: string // 예: 'snaply-{yyyy}{MM}{dd}-{HH}{mm}{ss}'
  language: 'ko' | 'en'
  theme: 'light' | 'dark' | 'system'
  autoStart: boolean
  afterCapture: AfterCaptureAction
  onboardingDone: boolean
}

// ───────────────────────── OCR ─────────────────────────

export interface OcrRequest {
  /** 이미지 파일 경로 또는 dataURL */
  source: string
  languages?: string // 'kor+eng'
}

export interface OcrResult {
  text: string
  words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }>
}

// ───────────────────────── 내보내기 ─────────────────────────

export type ExportFormat = 'png' | 'jpg' | 'webp' | 'pdf' | 'tiff' | 'pptx'

export interface ExportRequest {
  itemId?: string
  /** 에디터에서 넘기는 경우 dataURL */
  dataUrl?: string
  format: ExportFormat
  /** 미지정 시 저장 다이얼로그 */
  targetPath?: string
}

// ───────────────────────── invoke 채널 (renderer → main, 응답 있음) ─────────────────────────

export interface InvokeChannels {
  'capture:start': { req: CaptureOptions; res: void }
  'capture:cancel': { req: void; res: void }
  /** 오버레이에서 영역 확정 → 메인이 크롭·저장 후 CaptureResult 반환 */
  'capture:commitRegion': { req: RegionRect; res: CaptureResult }
  'capture:commitWindow': { req: { sourceId: string; title?: string; appName?: string }; res: CaptureResult }
  'capture:commitFullscreen': { req: { displayId: number }; res: CaptureResult }
  'capture:listDisplays': { req: void; res: DisplayInfo[] }
  'capture:listWindows': {
    req: void
    res: Array<{ sourceId: string; title: string; appName?: string; thumbnailDataUrl: string }>
  }
  'capture:scrolling:start': { req: RegionRect; res: CaptureResult }
  /** 오버레이 캡슐에서 모드 변경 → 메인이 모든 오버레이 창에 event:overlayMode 브로드캐스트 */
  'overlay:setMode': { req: CaptureMode; res: void }
  /** 고정 크기 배치 모드: W×H 사각형이 마우스를 따라다니고 클릭한 곳에 지정된다.
   * null이면 배치 모드 해제. 모든 오버레이 창에 event:overlayPreset으로 릴레이 */
  'overlay:armPreset': { req: { w: number; h: number } | null; res: void }
  /** 선택 영역을 모니터 사이로 옮길 때 절대(가상 데스크톱) 좌표를 다른 오버레이 창들과 동기화.
   * final=false: 드래그 중 미리보기, final=true: 드롭 — 중심이 속한 디스플레이 창이 영역을 이어받는다 */
  'overlay:syncRect': {
    req: { rect: { x: number; y: number; width: number; height: number } | null; final: boolean; sourceDisplayId: number }
    res: void
  }

  'clipboard:writeImage': { req: { dataUrl?: string; filePath?: string }; res: void }
  'clipboard:writeText': { req: string; res: void }

  'library:list': { req: LibraryQuery; res: LibraryItem[] }
  'library:get': { req: string; res: LibraryItem | null }
  'library:update': { req: { id: string; patch: Partial<LibraryItem> }; res: void }
  'library:delete': { req: string; res: void }
  'library:folders': { req: void; res: LibraryFolder[] }
  'library:createFolder': { req: string; res: LibraryFolder }
  'library:deleteFolder': { req: string; res: void }
  /** 에디터에서 편집 결과 저장 (새 항목 or 덮어쓰기) */
  'library:saveEdited': { req: { itemId?: string; dataUrl: string; overwrite: boolean }; res: LibraryItem }

  'record:start': { req: RecordOptions; res: void }
  'record:stop': { req: void; res: RecordResult }
  'record:pause': { req: void; res: void }
  'record:resume': { req: void; res: void }
  /** WebM blob을 넘겨 MP4/GIF로 변환·저장 */
  'record:finalize': {
    req: { webmDataUrl: string; format: 'mp4' | 'gif'; trimStartMs?: number; trimEndMs?: number; fps?: number }
    res: RecordResult
  }

  'ocr:run': { req: OcrRequest; res: OcrResult }

  'export:run': { req: ExportRequest; res: { filePath: string } }
  'export:batch': {
    req: {
      itemIds: string[]
      resize?: { width?: number; height?: number }
      watermarkText?: string
      format?: 'png' | 'jpg' | 'webp'
    }
    res: { outputDir: string; count: number }
  }

  'settings:get': { req: void; res: AppSettings }
  'settings:set': { req: Partial<AppSettings>; res: AppSettings }

  /** 공유 대상 플러그인 목록 (1차: 로컬 저장/클립보드/이메일. Slack/Drive는 stub) */
  'share:targets': { req: void; res: Array<{ id: string; label: string; available: boolean; comingSoon?: boolean }> }
  'share:run': { req: { targetId: string; itemId?: string; filePath?: string }; res: { ok: boolean; message?: string } }

  'window:open': { req: { window: 'editor' | 'library' | 'settings' | 'recorder'; payload?: unknown }; res: void }
  'window:close': { req: void; res: void }
  'window:minimize': { req: void; res: void }
  'window:maximize': { req: void; res: void }

  'file:readDataUrl': { req: string; res: string }
  'file:showInFolder': { req: string; res: void }
  /** 폴더 선택 다이얼로그. 취소하면 null */
  'dialog:pickFolder': { req: { title?: string; defaultPath?: string }; res: string | null }

  'app:getVersion': { req: void; res: string }
}

// ───────────────────────── 이벤트 채널 (main → renderer, 단방향) ─────────────────────────

export interface EventChannels {
  /** 캡처 완료 브로드캐스트 (트레이/라이브러리 갱신용) */
  'event:captureCompleted': CaptureResult
  /** 에디터 창에 열 항목 전달 */
  'event:openInEditor': { itemId: string; filePath: string }
  /** 오버레이 창에 캡처 세션 시작 알림.
   * 듀얼 모니터: 디스플레이당 오버레이 창 1개 — 각 창은 자기 디스플레이 프레임만 받는다 */
  'event:overlayStart': {
    mode: CaptureMode
    frozenFrames: Array<{ displayId: number; dataUrl: string }>
    /** 이 오버레이 창이 담당하는 디스플레이 */
    display?: DisplayInfo
    /** 모드 캡슐/창 목록을 이 창에 표시할지 (커서가 있는 디스플레이만 true) */
    showCapsule?: boolean
  }
  'event:overlayCancel': void
  /** 캡슐에서 모드 변경 시 모든 오버레이 창 동기화 */
  'event:overlayMode': CaptureMode
  /** 지연 캡처 카운트다운 (남은 초, 0이면 종료) — 커서 디스플레이 오버레이에 표시 */
  'event:overlayCountdown': number
  /** 카운트다운 중 캡처 예정 영역 포커스 테두리 (해당 디스플레이 창 로컬 좌표, null이면 숨김) */
  'event:overlayFocusRegion': { x: number; y: number; width: number; height: number } | null
  /** 고정 크기 배치 모드 동기화 (overlay:armPreset 릴레이) */
  'event:overlayPreset': { w: number; h: number } | null
  /** 선택 영역 모니터 간 이동 동기화 (overlay:syncRect 릴레이) */
  'event:overlayRect': {
    rect: { x: number; y: number; width: number; height: number } | null
    final: boolean
    sourceDisplayId: number
  }
  /** 녹화 상태 변경 */
  'event:recordState': { state: 'idle' | 'countdown' | 'recording' | 'paused' | 'processing'; elapsedMs?: number }
  /** 라이브러리 변경 브로드캐스트 */
  'event:libraryChanged': void
  /** 설정 변경 브로드캐스트 */
  'event:settingsChanged': AppSettings
  /** 스크롤 캡처 진행률 (0~1) */
  'event:scrollProgress': number
}

export type InvokeChannel = keyof InvokeChannels
export type EventChannel = keyof EventChannels

// ───────────────────────── preload가 노출하는 API 형태 ─────────────────────────

export interface SnaplyApi {
  invoke<C extends InvokeChannel>(channel: C, payload: InvokeChannels[C]['req']): Promise<InvokeChannels[C]['res']>
  on<C extends EventChannel>(channel: C, listener: (payload: EventChannels[C]) => void): () => void
  platform: 'win32' | 'darwin' | 'linux' | string
}

declare global {
  interface Window {
    snaply: SnaplyApi
  }
}
