import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MarketingAuthShell } from './MarketingAuthShell'
import { toast } from '@/components/ui/toast'
import { api, apiErrorMessage } from '@/lib/api'
import { useT } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import type { TokenResponse } from '@/types/api'

/**
 * Google dönüş ekranı (`/auth/google`).
 *
 * Sunucu bizi buraya **tek kullanımlık bir bilet** ile yollar; burada bilet
 * `POST /auth/google/exchange` ile oturum jetonuna çevrilir.
 *
 * ⚠️ <b>Hiçbir guard'ın altında DEĞİL.</b> `RedirectIfAuthed` altında olsaydı
 * `setSession` çalışır çalışmaz guard aynı render'da `/map`'e yönlendirir ve
 * aşağıdaki `navigate` hiç çalışmazdı — yani `next` hedefi kaybolurdu
 * (vault 12-tuzaklar: "oturum açılınca guard yönlendirmesi navigate()'i ezer").
 *
 * ⚠️ <b>Bilet tek kullanımlıktır ve React 19 StrictMode efektleri İKİ KEZ
 * koşar.</b> Korumasız bırakılırsa ilk çağrı başarılı olur, ikincisi "bilet
 * kullanılmış" der ve kullanıcı hata ekranı görür. `useRef` bayrağı şart —
 * boş bağımlılık dizisi tek başına yetmez (aynı tuzak `/verify-email`'de
 * yaşanmıştı).
 */
export function GoogleCallbackPage() {
  const t = useT()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const ticket = params.get('ticket')
    const serverError = params.get('error')
    const next = params.get('next')
    // Sunucu zaten temizliyor; istemcide ikinci kez kontrol edilir çünkü bu
    // değer doğrudan yönlendirmeye giriyor (açık yönlendirme kapısı).
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/map'

    if (serverError || !ticket) {
      // "cancelled" = kullanıcı Google ekranında vazgeçti; hata değil.
      if (serverError === 'cancelled') {
        navigate('/login', { replace: true })
        return
      }
      setError(t('auth.googleFailed'))
      return
    }

    api
      .post<TokenResponse>('/auth/google/exchange', { ticket })
      .then(({ data }) => {
        setSession(data)
        toast.success(t('auth.welcomeBack', { name: data.user.displayName }))
        navigate(safeNext, { replace: true })
      })
      .catch((err) => setError(apiErrorMessage(err, t('auth.googleFailed'))))
    // Tek çalışma garantisi yukarıdaki ref ile; bağımlılıklar bilinçli olarak boş.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <MarketingAuthShell>
      {error ? (
        <>
          <h2 className="mb-3 text-2xl uppercase">{t('auth.googleFailedTitle')}</h2>
          <div className="waydee-auth-error mb-2 flex items-center gap-3 rounded-none p-4">
            <p className="flex-1 text-sm font-semibold uppercase tracking-wide">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="waydee-auth-submit mt-4 flex h-10 w-1/2 items-center justify-center rounded-none px-4 text-sm uppercase transition-colors"
          >
            {t('auth.backToLogin')}
          </button>
        </>
      ) : (
        <>
          <h2 className="mb-3 text-2xl uppercase">{t('auth.googleSigningIn')}</h2>
          <div className="flex items-center gap-3 text-sm uppercase text-[#71717a]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            {t('auth.googlePleaseWait')}
          </div>
        </>
      )}
    </MarketingAuthShell>
  )
}
