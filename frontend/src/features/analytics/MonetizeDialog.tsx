import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { createMonetizationRequest } from '@/lib/monetization'
import { useT } from '@/i18n'

/**
 * <b>Gelir başvurusu formu.</b>
 *
 * <p>🔴 8 Ağu 2026 — "Etkini gelire dönüştür" kartındaki düğme bu tura kadar
 * <b>hiçbir şey yapmıyordu</b> (`onClick` bile yoktu). Artık gerçek bir
 * başvuru gönderir; yönetici panelden görür ve karara bağlar.
 *
 * <p>⚠️ İstenen alanlar <b>az</b> tutuldu: kitle anlatımı zorunlu, kanal ve
 * iletişim adresi opsiyonel. Uzun bir form dönüşümü kırar; yöneticinin karar
 * vermek için ihtiyacı olan asgari bilgi budur ve gerisini e-postayla sorabilir.
 *
 * <p>⚠️ İletişim adresi boş bırakılabilir — sunucu o zaman hesabın e-postasını
 * kullanır. Zorunlu yapmak, adresini zaten doğrulamış kullanıcıya aynı şeyi
 * ikinci kez yazdırmak olurdu.
 */
export function MonetizeDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [audienceNote, setAudienceNote] = useState('')
  const [primaryChannel, setPrimaryChannel] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const submit = useMutation({
    mutationFn: () =>
      createMonetizationRequest({
        audienceNote: audienceNote.trim(),
        primaryChannel: primaryChannel.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t('analytics.monetizeSent'))
      void queryClient.invalidateQueries({ queryKey: ['monetization-request'] })
      onClose()
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('analytics.monetizeFailed'))),
  })

  const canSubmit = audienceNote.trim().length >= 10 && !submit.isPending

  return (
    <Dialog open onClose={onClose} title={t('analytics.monetizeTitle')} className="max-w-md">
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-muted">{t('analytics.monetizeFormIntro')}</p>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">
            {t('analytics.monetizeAudience')}
          </span>
          <Textarea
            value={audienceNote}
            onChange={(e) => setAudienceNote(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder={t('analytics.monetizeAudiencePlaceholder')}
          />
          {/* ⚠️ Sayaç ve asgari uzunluk görünür: "gönder" pasifken kullanıcı
              nedenini bilmeli, yoksa düğme bozuk sanılır. */}
          <span className="mt-1 block text-[11px] font-medium text-faint">
            {audienceNote.trim().length}/1000 · {t('analytics.monetizeMinChars')}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">
            {t('analytics.monetizeChannel')}
          </span>
          <Input
            value={primaryChannel}
            onChange={(e) => setPrimaryChannel(e.target.value)}
            maxLength={300}
            placeholder="instagram.com/kullaniciadi"
            dir="ltr"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">
            {t('analytics.monetizeContact')}
          </span>
          <Input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            maxLength={255}
            placeholder={t('analytics.monetizeContactPlaceholder')}
            dir="ltr"
          />
        </label>

        <div className="flex gap-2 pt-1">
          <Button variant="subtle" className="flex-1" onClick={onClose} disabled={submit.isPending}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1" onClick={() => submit.mutate()} disabled={!canSubmit}>
            {submit.isPending ? (
              <Spinner className="border-on-ink/30 border-t-on-ink" />
            ) : (
              t('analytics.monetizeSubmit')
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
