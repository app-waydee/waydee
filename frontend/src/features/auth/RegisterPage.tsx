import { useState, type ChangeEvent, type FormEvent } from 'react'
import { AuthField } from './AuthField'
import {
  AuthCard,
  AuthHeading,
  AuthLegal,
  AuthSubmit,
  AuthTertiary,
  MarketingAuthShell,
} from './MarketingAuthShell'
import { SocialAuthButtons } from './SocialAuthButtons'
import { TurnstileWidget, useTurnstile } from '@/components/security/Turnstile'
import { toast } from '@/components/ui/toast'
import { api, apiErrorMessage } from '@/lib/api'
import { useT } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useNavigate } from 'react-router-dom'
import type { TokenResponse } from '@/types/api'

/**
 * Kayıt ekranı — <b>referansın "Hesabınızı Oluşturun" akışı birebir</b>.
 *
 * 🔴 <b>Giriş ekranından FARKLIDIR.</b> Giriş iki kolonludur; kayıt
 * <b>tek kolon, 342px</b> ve <b>iki adımlıdır</b> (canlı sayfada gezilerek
 * doğrulandı):
 *
 * ```
 * 1. adım   başlık (mb 33) → hukuki metin (mb 33)
 *           → Google / Apple / Facebook / E-posta ile devam edin  (li mb 11)
 * 2. adım   Ad · Soyadı · E-posta adresi · Parola
 *           → hukuki metin → DEVAM EDİN (siyah) → GERİ (tertiary)
 * ```
 *
 * ⚠️ Referansta ilk adımda yalnız Google görünür ve altta "Daha fazla
 * seçenek" düğmesi durur; kullanıcı üçünü birden istediği için burada
 * <b>üçü de doğrudan</b> çizilir (o düğmeye gerek kalmaz).
 */
export function RegisterForm({ onDone }: { onDone?: () => void }) {
  const t = useT()
  const [step, setStep] = useState<'providers' | 'email'>('providers')
  const [form, setForm] = useState({ username: '', email: '', displayName: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()
  const turnstile = useTurnstile()

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post<TokenResponse>('/auth/register', {
        ...form,
        username: form.username.toLowerCase(),
        turnstileToken: turnstile.token ?? undefined,
      })
      /*
       * 🔴 10 Ağu 2026 — YENİ KAYIT ARTIK ANA SAYFAYA GİDİYOR.
       * Önceden burada `ONBOARDING_FLAG` konup `/kartim`'a (paylaşım kartı)
       * gidiliyordu. Kullanıcı bunu kapattı: kart artık <b>mağaza duyuru
       * kartıdır</b> ve yalnız Premium üye haritada mağazasını açtığında
       * üretilir (`StorePanel` → `onCreated`). Kayıt anında duyurulacak bir
       * şey yoktu — kartın konumu, alanı, gidilecek adresi boştu.
       * ⚠️ Bayrak da kaldırıldı; `RedirectIfAuthed` artık onu hiç okumuyor.
       */
      setSession(data)
      toast.success(t('auth.registerSuccess', { email: data.user.email }))
      onDone?.()
      navigate('/home')
    } catch (err) {
      turnstile.reset()
      const message = apiErrorMessage(err, t('auth.registerFailed'))
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    form.email.trim() !== '' &&
    form.displayName.trim() !== '' &&
    form.username.trim() !== '' &&
    form.password !== '' &&
    turnstile.ready

  return (
    <AuthCard>
      <AuthHeading>{t('auth.registerTitle')}</AuthHeading>

      {step === 'providers' ? (
        <>
          {/* Referans sırası: başlık → hukuki metin → sağlayıcılar. */}
          <AuthLegal className="mb-[33px] mt-0">{t('auth.legalSignup')}</AuthLegal>
          <SocialAuthButtons onEmail={() => setStep('email')} />
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="flex flex-col gap-[22px]">
            <AuthField
              label={t('auth.displayName')}
              placeholder="Deniz Yıldız"
              value={form.displayName}
              onChange={set('displayName')}
              minLength={2}
              maxLength={60}
              autoFocus
              required
            />
            <AuthField
              label={t('auth.username')}
              placeholder="deniz_yildiz"
              value={form.username}
              onChange={set('username')}
              autoComplete="username"
              pattern="[a-zA-Z0-9_]{3,30}"
              title={t('auth.usernameHint')}
              required
            />
            <AuthField
              label={t('auth.email')}
              type="email"
              placeholder="isim@ornek.com"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
            />
            <AuthField
              label={t('auth.password')}
              type="password"
              placeholder={t('auth.password')}
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <TurnstileWidget
            className="mt-[22px]"
            onToken={turnstile.setToken}
            handleRef={turnstile.handleRef}
          />

          {error && (
            <div className="sq-alert mt-[22px]" role="alert">
              {error}
            </div>
          )}

          <AuthLegal>{t('auth.legalSignup')}</AuthLegal>

          <AuthSubmit disabled={loading || !canSubmit} loading={loading}>
            {t('common.continue')}
          </AuthSubmit>

          {/* Referansın "GERİ" tertiary düğmesi. */}
          <div className="mt-[11px] flex justify-center">
            <AuthTertiary onClick={() => setStep('providers')}>{t('common.back')}</AuthTertiary>
          </div>
        </form>
      )}
    </AuthCard>
  )
}

/** Doğrudan `/register` adresine gidildiğinde açılan tam sayfa. */
export function RegisterPage() {
  return (
    <MarketingAuthShell>
      <RegisterForm />
    </MarketingAuthShell>
  )
}
