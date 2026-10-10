import { useCallback, useEffect, useRef, useState } from 'react'
import { useThemeStore } from '@/stores/theme'

/**
 * Cloudflare Turnstile (bot koruması) widget'ı.
 *
 * Site key `.env` → `VITE_TURNSTILE_SITE_KEY` ile gelir; **yoksa widget hiç
 * render edilmez** ve form normal çalışır (offline geliştirme). Gizli anahtar
 * yalnızca sunucudadır; burada sadece jeton üretilir ve backend doğrular.
 */

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim()
export const turnstileEnabled = !!SITE_KEY

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
      theme?: 'light' | 'dark' | 'auto'
      size?: 'normal' | 'compact' | 'flexible'
    },
  ) => string
  remove: (widgetId: string) => void
  reset: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/** Script'i bir kez yükler; birden çok widget aynı sözü paylaşır. */
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('turnstile yüklenemedi')))
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('turnstile yüklenemedi'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export interface TurnstileHandle {
  /** Jeton tek kullanımlıktır: başarısız denemeden sonra yenisi istenir. */
  reset: () => void
}

export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null)
  const handleRef = useRef<TurnstileHandle | null>(null)

  const reset = useCallback(() => {
    setToken(null)
    handleRef.current?.reset()
  }, [])

  return {
    token,
    setToken,
    handleRef,
    reset,
    /** Widget varken jeton gelmeden gönderim engellenir. */
    ready: !turnstileEnabled || !!token,
  }
}

export function TurnstileWidget({
  onToken,
  handleRef,
  className,
  forceTheme,
}: {
  onToken: (token: string | null) => void
  handleRef?: React.MutableRefObject<TurnstileHandle | null>
  className?: string
  /**
   * Widget temasını <b>zorla</b>. Varsayılan uygulamanın temasını takip eder;
   * ziyaretçi kapısı gibi <b>temadan bağımsız koyu</b> yüzeylerde açık temalı
   * bir widget koyu zeminde beyaz bir dikdörtgen gibi duruyordu.
   */
  forceTheme?: 'light' | 'dark'
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const themeMode = useThemeStore((s) => s.mode)
  const [failed, setFailed] = useState(false)
  // Geri çağrı kimliği değişince widget'ı yeniden kurmayalım diye ref'te tutulur.
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    if (!turnstileEnabled) return
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        // StrictMode'da efekt iki kez koşar; önceki widget temizlenmeden yenisi kurulmaz.
        if (widgetIdRef.current) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY as string,
          theme: forceTheme ?? (themeMode === 'dark' ? 'dark' : 'light'),
          size: 'flexible',
          callback: (t) => onTokenRef.current(t),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => {
            setFailed(true)
            onTokenRef.current(null)
          },
        })
        if (handleRef) {
          handleRef.current = {
            reset: () => {
              if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current)
            },
          }
        }
      })
      .catch(() => setFailed(true))

    return () => {
      cancelled = true
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
      if (handleRef) handleRef.current = null
    }
    // Tema değişince widget'ı yeniden kurmak yerine olduğu gibi bırakırız (kurulum maliyetli).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!turnstileEnabled) return null

  return (
    <div className={className}>
      <div ref={containerRef} />
      {failed && (
        <p className="mt-2 text-[13px] font-medium text-danger">
          Bot doğrulaması yüklenemedi. Bağlantını kontrol edip sayfayı yenile.
        </p>
      )}
    </div>
  )
}
