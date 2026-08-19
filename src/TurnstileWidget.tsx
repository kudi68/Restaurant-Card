import { useEffect, useRef } from 'react'

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string
    action: string
    theme: 'light' | 'dark' | 'auto'
    size: 'flexible'
    callback: (token: string) => void
    'expired-callback': () => void
    'error-callback': () => void
  }) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let turnstileScript: Promise<void> | null = null

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (turnstileScript) return turnstileScript

  const loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-restaurant-card-turnstile]')
    const script = existing ?? document.createElement('script')
    const onLoad = () => resolve()
    const onError = () => {
      script.remove()
      reject(new Error('turnstile_load_failed'))
    }
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.restaurantCardTurnstile = 'true'
      document.head.appendChild(script)
    }
  })
  const retryable = loading.catch((error: unknown) => {
    turnstileScript = null
    throw error
  })
  turnstileScript = retryable
  return retryable
}

export function TurnstileWidget({
  siteKey,
  theme,
  resetVersion,
  onToken,
}: {
  siteKey: string
  theme: 'light' | 'dark'
  resetVersion: number
  onToken: (token: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: 'feedback',
          theme,
          size: 'flexible',
          callback: onToken,
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        })
      })
      .catch(() => {
        if (!cancelled) onToken('')
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
      widgetIdRef.current = null
    }
  }, [onToken, siteKey, theme])

  useEffect(() => {
    if (resetVersion > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
    }
  }, [resetVersion])

  return <div ref={containerRef} className="mt-3 min-h-[65px] w-full" aria-label="防機器人驗證" />
}
