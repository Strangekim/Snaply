/** 후원(Ko-fi) 링크. 소유자: Architect.
 * TODO(release): 배포 전에 실제 Ko-fi 계정 URL로 교체할 것 (ko-fi.com에서 계정 생성) */
export const SUPPORT_URL = 'https://ko-fi.com/snaply'

/** 외부 브라우저로 후원 페이지 열기.
 * (모든 창의 setWindowOpenHandler가 window.open을 shell.openExternal로 돌린다) */
export function openSupportPage(): void {
  window.open(SUPPORT_URL)
}
