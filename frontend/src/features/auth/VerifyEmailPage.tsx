import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, MailWarning } from 'lucide-react'
import { AuthShell } from './AuthShell'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { apiErrorMessage } from '@/lib/api'
import { verifyEmail, type VerificationPurpose } from '@/lib/verification'
import { useAuthStore } from '@/stores/auth'

type State =
  | { kind: 'working' }
  | { kind: 'done'; purpose: VerificationPurpose; email: string }
  | { kind: 'failed'; message: string }

/**
 * Doğrulama bağlantısının açtığı ekran. Bağlantıya <b>farklı bir cihazdan</b>
 * tıklanabildiği için oturum gerektirmez.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState<State>({ kind: 'working' })
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // ⚠️ Jeton TEK KULLANIMLIK: StrictMode'da efekt iki kez koşar ve ikinci
  // çağrı "geçersiz bağlantı" derdi. Bu yüzden bir kez çalışması garantilenir.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!token) {
      setState({ kind: 'failed', message: 'Bağlantıda doğrulama kodu yok.' })
      return
    }
    verifyEmail(token)
      .then((result) => {
        setState({ kind: 'done', purpose: result.purpose, email: result.email })
        // Oturum açıksa yerel kullanıcı kaydı bayatlamasın (şerit kaybolsun,
        // adres değiştiyse yeni adres görünsün).
        if (user) {
          setUser({ ...user, email: result.email, emailVerified: true })
          void queryClient.invalidateQueries({ queryKey: ['me'] })
        }
      })
      .catch((error) => {
        setState({ kind: 'failed', message: apiErrorMessage(error, 'Bağlantı doğrulanamadı') })
      })
    // Yalnız açılışta bir kez — bağımlılıklar bilinçli olarak boş.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state.kind === 'working') {
    return (
      <AuthShell title="Doğrulanıyor" subtitle="Bağlantın kontrol ediliyor…">
        <div className="flex justify-center py-6">
          <Spinner className="h-7 w-7" />
        </div>
      </AuthShell>
    )
  }

  if (state.kind === 'failed') {
    return (
      <AuthShell
        title="Bağlantı geçersiz"
        subtitle="Bu bağlantı kullanılmış ya da süresi dolmuş olabilir."
        footer={
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Giriş ekranına dön
          </Link>
        }
      >
        <div className="flex items-start gap-3 rounded-2xl bg-subtle p-4">
          <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <p className="text-sm font-medium leading-relaxed text-muted">{state.message}</p>
        </div>
        <p className="mt-5 text-sm font-medium text-muted">
          Hesabına giriş yapıp üstteki şeritten <strong className="text-ink">yeni bir bağlantı</strong> isteyebilirsin.
        </p>
        <Button size="lg" className="mt-5 w-full" onClick={() => navigate('/login')}>
          Giriş yap
        </Button>
      </AuthShell>
    )
  }

  const changed = state.purpose === 'EMAIL_CHANGE'
  return (
    <AuthShell
      title={changed ? 'Adresin güncellendi' : 'E-postan doğrulandı'}
      subtitle={changed ? 'Hesabın artık yeni adresle çalışıyor.' : 'Hesabın kullanıma hazır.'}
    >
      <div className="flex items-start gap-3 rounded-2xl bg-mint-soft p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <p className="text-sm font-medium leading-relaxed text-ink">
          <span className="font-semibold">{state.email}</span> doğrulandı.
        </p>
      </div>
      <Button size="lg" className="mt-5 w-full" onClick={() => navigate(user ? '/map' : '/login')}>
        {user ? 'Haritaya git' : 'Giriş yap'}
      </Button>
    </AuthShell>
  )
}
