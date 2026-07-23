/** 후원(Ko-fi) 링크. 소유자: Architect. */
export const SUPPORT_URL = 'https://ko-fi.com/snaply_'

/** 외부 브라우저로 후원 페이지 열기.
 * (모든 창의 setWindowOpenHandler가 window.open을 shell.openExternal로 돌린다) */
export function openSupportPage(): void {
  window.open(SUPPORT_URL)
}
