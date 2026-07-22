/**
 * 자동 시작(로그인 시 실행) 적용. 소유자: Architect-P4.
 * Windows: app.setLoginItemSettings({ openAtLogin }) — 레지스트리 Run 키에 등록된다.
 * macOS: 동일 API가 Login Items에 등록한다. TODO(platform-verify): macOS 13+ 에서는
 *   시스템 설정 > 일반 > 로그인 항목에 노출되는지 실기기 확인 필요.
 */
import { app } from 'electron'
import { getSettings } from './settings'

/** 자동 시작 설정을 OS에 반영한다. 개발 모드에서는 no-op (electron.exe가 등록되는 것을 방지) */
export function applyAutoStart(enabled: boolean): void {
  if (!app.isPackaged) {
    // 개발 모드: process.execPath가 electron.exe라 등록하면 개발용 바이너리가 자동 시작됨 — 건너뛴다
    return
  }
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: ['--autostart']
    })
  } catch {
    // 일부 환경(포터블 실행 등)에서 실패할 수 있음 — 설정값은 유지하고 조용히 무시
  }
}

/** 앱 시작 시 1회: 저장된 설정과 OS 상태를 동기화한다 */
export function syncAutoStart(): void {
  applyAutoStart(getSettings().autoStart)
}
