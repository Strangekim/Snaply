import { useEffect } from 'react'
import type { AppSettings } from '@shared/ipc'

function apply(theme: AppSettings['theme']): void {
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

/** 설정의 테마를 구독해 <html data-theme>를 갱신한다 */
export function useTheme(): void {
  useEffect(() => {
    let theme: AppSettings['theme'] = 'system'
    void window.snaply.invoke('settings:get', undefined).then((s) => {
      theme = s.theme
      apply(theme)
    })
    const offSettings = window.snaply.on('event:settingsChanged', (s) => {
      theme = s.theme
      apply(theme)
    })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onMq = (): void => apply(theme)
    mq.addEventListener('change', onMq)
    return () => {
      offSettings()
      mq.removeEventListener('change', onMq)
    }
  }, [])
}
