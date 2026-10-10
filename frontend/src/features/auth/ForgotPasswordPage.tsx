import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthField } from './AuthField'
import {
  AuthCard,
  AuthHeading,
  AuthSubmit,
  AuthTertiary,
  MarketingAuthShell,
} from './MarketingAuthShell'
import { TurnstileWidget, useTurnstile } from '@/components/security/Turnstile'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { useT } from '@/i18n'
import { forgotPassword } from '@/lib/verification'

/**
 * Parola kurtarma — referansın <b>"Parolamı Unuttum"</b> ekranı birebir
 * (canlı sayfada "Giriş yapamıyor musun?" bağlantısından gezilerek çıkarıldı).
 *
 * ```
 * başlık "Parolamı Unuttum"
 * açıklama (Text.Body, gray.300)
 * E-POSTA ADRESİ  →  isim@ornek.com
 * E-POSTA GÖNDERİN            (siyah, tam genişlik, mt 33)
 * E-POSTA ADRESİNİ Mİ UNUTTUNUZ?   (tertiary, alt çizgisi açılan)
 * ```
 * Tek kolon, <b>342px</b> — kayıt ekranıyla aynı kart.
 */
export function ForgotPasswordPage() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const navigate = useNavigate()
  const turnstile = useTurnstile()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email, turnstile.token ?? undefined)
      // ⚠️ Sunucu adres kayıtlı olmasa da 204 döner (enumeration yok) — ekran
      // da bu yüzden her durumda aynı şeyi söyler.
      setSent(true)
    } catch (error) {
      turnstile.reset()
      toast.error(apiErrorMessage(error, t('auth.forgotFailed')))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <MarketingAuthShell>
        <AuthCard>
          <AuthHeading caption={t('auth.forgotSentBody', { email })}>
            {t('auth.forgotSentTitle')}
          </AuthHeading>
          <div className="flex justify-center">
            <AuthTertiary onClick={() => navigate('/login')}>{t('auth.backToLogin')}</AuthTertiary>
          </div>
        </AuthCard>
      </MarketingAuthShell>
    )
  }

  return (
    <MarketingAuthShell>
      <AuthCard>
        <AuthHeading caption={t('auth.forgotSubtitle')}>{t('auth.forgotTitle')}</AuthHeading>
        <form onSubmit={submit} noValidate>
          <AuthField
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="isim@ornek.com"
            autoComplete="email"
            autoFocus
            required
          />
          <TurnstileWidget
            className="mt-[22px]"
            onToken={turnstile.setToken}
            handleRef={turnstile.handleRef}
          />
          <AuthSubmit disabled={loading || !email.trim() || !turnstile.ready} loading={loading}>
            {t('auth.sendResetLink')}
          </AuthSubmit>
          <div className="mt-[11px] flex justify-center">
            <AuthTertiary onClick={() => navigate('/login')}>{t('auth.backToLogin')}</AuthTertiary>
          </div>
        </form>
      </AuthCard>
    </MarketingAuthShell>
  )
}
