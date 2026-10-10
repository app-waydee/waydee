import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MailWarning } from 'lucide-react'
import { AuthShell } from './AuthShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { resetPassword } from '@/lib/verification'
import { useAuthStore } from '@/stores/auth'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const clear = useAuthStore((s) => s.clear)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== repeat) {
      toast.error('Şifreler eşleşmiyor')
      return
    }
    setLoading(true)
    try {
      await resetPassword(token ?? '', password)
      // Sunucu tüm refresh token'ları iptal etti; elde kalan oturum artık ölü.
      clear()
      toast.success('Şifren güncellendi, şimdi giriş yapabilirsin')
      navigate('/login', { replace: true })
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Şifre güncellenemedi'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Bağlantı geçersiz"
        subtitle="Sıfırlama kodu bulunamadı."
        footer={
          <Link to="/forgot-password" className="font-semibold text-accent hover:underline">
            Yeni bağlantı iste
          </Link>
        }
      >
        <div className="flex items-start gap-3 rounded-2xl bg-subtle p-4">
          <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <p className="text-sm font-medium leading-relaxed text-muted">
            Bu sayfaya e-postandaki bağlantıyla gelmelisin.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Yeni şifre belirle"
      subtitle="Şifreni değiştirdiğinde açık olan tüm oturumlar kapanır."
      footer={
        <Link to="/login" className="font-semibold text-accent hover:underline">
          Giriş ekranına dön
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-3.5 md:space-y-5">
        <div>
          <Label htmlFor="new-password">Yeni şifre</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="mt-1.5 text-xs font-medium text-muted">
            En az 8 karakter, bir harf ve bir rakam içermeli.
          </p>
        </div>
        <div>
          <Label htmlFor="repeat-password">Yeni şifre (tekrar)</Label>
          <Input
            id="repeat-password"
            type="password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Spinner className="border-on-ink/30 border-t-on-ink" /> : 'Şifreyi güncelle'}
        </Button>
      </form>
    </AuthShell>
  )
}
