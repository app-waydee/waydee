import { useState } from 'react'
import { MailWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { resendMyVerification } from '@/lib/verification'
import { useAuthStore } from '@/stores/auth'
import { useT } from '@/i18n'

/**
 * Doğrulanmamış hesaplar için uyarı şeridi.
 *
 * <p>Uygulamayı kilitlemez — kullanıcı gezinmeye devam eder; yalnız satın alma
 * ve stant başvurusu sunucuda kapalıdır. Şerit, doğrulama tamamlanınca
 * kendiliğinden kaybolur (`user.emailVerified`).
 */
export function EmailVerificationBanner() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!user || user.emailVerified) return null

  const resend = async () => {
    setSending(true)
    try {
      await resendMyVerification()
      setSent(true)
      toast.success(t('verify.sent'))
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Bağlantı gönderilemedi'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-b border-line bg-sand-soft">
      {/* min-w-0: içerideki uzun e-posta adresi mobilde sayfayı yatayda taşırmasın. */}
      <div className="mx-auto flex min-w-0 max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:px-8">
        <MailWarning className="h-4 w-4 shrink-0 text-warn" />
        <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-ink">
          <span className="font-semibold">{user.email}</span> adresini doğrula — bölge kiralamak için gerekli.
        </p>
        <Button size="sm" variant="stroke" onClick={resend} disabled={sending || sent}>
          {sent ? 'Gönderildi' : sending ? 'Gönderiliyor…' : 'Tekrar gönder'}
        </Button>
      </div>
    </div>
  )
}
