import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthField } from './AuthField'
import {
  AuthColumns,
  AuthHeading,
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
import type { TokenResponse } from '@/types/api'

/**
 * Giriş ekranı — <b>`login.squarespace.com` birebir</b>.
 *
 * 🔴 <b>Yerleşim tek ekranda İKİ KOLONDUR</b>: solda e-posta/şifre formu ve
 * siyah <i>Oturum aç</i> düğmesi, sağda <i>Continue with …</i> sağlayıcı
 * düğmeleri, ortada dikey <b>"veya"</b> ayracı. Altta ortalanmış
 * <i>"Giriş yapamıyor musun?"</i> satırı durur.
 *
 * (Önceki sürümdeki iki adımlı "önce sağlayıcılar, sonra form" akışı
 * <b>yanlıştı</b> — canlı sayfada form ve sağlayıcılar aynı anda görünür.)
 */
export function LoginForm({ onDone }: { onDone?: () => void }) {
  const t = useT()
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const turnstile = useTurnstile()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post<TokenResponse>('/auth/login', {
        usernameOrEmail,
        password,
        turnstileToken: turnstile.token ?? undefined,
      })
      setSession(data)
      toast.success(t('auth.welcomeBack', { name: data.user.displayName }))
      onDone?.()
      /* 🔴 10 Ağu 2026 — varsayılan hedef `/home` (kullanıcı: "home'a aktar").
         ⚠️ `location.state.from` korunur: korumalı bir sayfaya gitmek isterken
         giriş ekranına düşen kullanıcı, giriş sonrası gitmek istediği yere
         devam etmeli — bu, ana sayfadan daha güçlü bir niyettir. */
      navigate(location.state?.from ?? '/home')
    } catch (err) {
      // Turnstile jetonu tek kullanımlık: başarısız denemeden sonra tazelenmeli.
      turnstile.reset()
      const message = apiErrorMessage(err, t('auth.loginFailed'))
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  // Referansta gönder düğmesi form geçerli olana kadar **gri ve pasiftir**
  // (`:disabled` → zemin #F2F2F2, metin #B7B7B7). Ekran görüntüsündeki hâli budur.
  const canSubmit = usernameOrEmail.trim() !== '' && password !== '' && turnstile.ready

  const form = (
    <form onSubmit={submit} noValidate>
      <div className="flex flex-col gap-[22px]">
        <AuthField
          label={t('auth.usernameOrEmail')}
          placeholder="deniz@ornek.com"
          value={usernameOrEmail}
          onChange={(e) => setUsernameOrEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <AuthField
          label={t('auth.password')}
          type="password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      {/* Bizim eklediğimiz tek alan: bot doğrulaması. Kolonun genişliğinde
          durur ve kendi çerçevesi yoktur. */}
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

      <AuthSubmit disabled={loading || !canSubmit} loading={loading}>
        {t('auth.login')}
      </AuthSubmit>
    </form>
  )

  return (
    <>
      {/* Giriş ekranında başlık altı boşluk 44px (`@space-8`) — ölçüldü.
          ⚠️ Referansta başlığın altında **alt başlık YOKTUR**
          (`login-subtitle` canlı sayfada hiç render edilmiyor); önceki
          sürümdeki "Waydee hesabınla" satırı bu yüzden kaldırıldı. */}
      <AuthHeading gap="mb-[44px]">{t('auth.loginTitle')}</AuthHeading>
      <AuthColumns
        form={form}
        providers={<SocialAuthButtons callbackUrl={location.state?.from} />}
      />
      {/* Referansın kapanış satırı: ortalanmış "CAN'T LOG IN?" */}
      <div className="mt-[33px] flex justify-center">
        <AuthTertiary
          onClick={() => {
            onDone?.()
            navigate('/forgot-password')
          }}
        >
          {t('auth.cantLogIn')}
        </AuthTertiary>
      </div>
    </>
  )
}

/** Doğrudan `/login` adresine gidildiğinde açılan tam sayfa. */
export function LoginPage() {
  return (
    <MarketingAuthShell>
      <LoginForm />
    </MarketingAuthShell>
  )
}
