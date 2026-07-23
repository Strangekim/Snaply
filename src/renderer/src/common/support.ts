/** 후원(Buy me a coffee) 링크. 소유자: Architect.
 * TODO(release): 배포 전에 실제 Buy Me a Coffee 계정 URL로 교체할 것 */
export const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/snaply'

/** 외부 브라우저로 후원 페이지 열기.
 * (모든 창의 setWindowOpenHandler가 window.open을 shell.openExternal로 돌린다) */
export function openSupportPage(): void {
  window.open(BUY_ME_A_COFFEE_URL)
}
