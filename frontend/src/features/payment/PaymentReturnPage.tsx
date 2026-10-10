import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, CreditCard, MailWarning, Share2 } from 'lucide-react'
import { AuthShell } from '@/features/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { cancelCheckout, confirmMockPayment, getCheckout, type CheckoutView } from '@/lib/payments'

/** Sunucu bildirimi gelene kadar bu aralıklarla yoklanır (saniye). */
const POLL_MS = 2000
const MAX_POLLS = 45

/**
 * Ödemeden dönüş ekranı.
 *
 * <p>⚠️ Ödemenin sonucu sağlayıcıdan **sunucuya** gelir (webhook), tarayıcıya
 * değil. Bu yüzden ekran, kullanıcının döndüğü anda değil, sunucudaki kayıt
 * `PAID` olduğunda "tamam" der — tarayıcıdaki dönüş adresine güvenmek,
 * ödemeden sonra adresi elle açan birine bölge vermek olurdu.
 */
export function PaymentReturnPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  // Sağlayıcı dönüş adresine parametre eklemeyebilir; oturum deposu yedektir.
  const checkoutId = params.get('checkout') ?? params.get('reservation') ?? sessionStorage.getItem('waydee-checkout')
  const isMock = params.get('mock') === '1'
  // 🔴 Bekleyen ekranda da lazım: üyelik ödemesinde bölge adı/etiketi YOKTUR.
  const isPlanKind = (kind: CheckoutView['kind']) => kind === 'PLAN_PRO' || kind === 'PLAN_PREMIUM'

  const [checkout, setCheckout] = useState<CheckoutView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const polls = useRef(0)

  const load = useCallback(async () => {
    if (!checkoutId) return null
    try {
      const data = await getCheckout(checkoutId)
      setCheckout(data)
      return data
    } catch (e) {
      setError(apiErrorMessage(e, 'Ödeme kaydı okunamadı'))
      return null
    }
  }, [checkoutId])

  useEffect(() => {
    if (!checkoutId) {
      setError('Ödeme kaydı bulunamadı.')
      return
    }
    let timer: number | undefined
    let cancelled = false
    const tick = async () => {
      const data = await load()
      if (cancelled) return
      // Sahte sağlayıcıda kullanıcı düğmeye basacak; boşuna yoklamayalım.
      if (!data || data.status !== 'PENDING' || isMock) return
      if (++polls.current >= MAX_POLLS) return
      timer = window.setTimeout(tick, POLL_MS)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [checkoutId, isMock, load])

  const confirmMock = async () => {
    if (!checkoutId) return
    setConfirming(true)
    try {
      setCheckout(await confirmMockPayment(checkoutId))
      toast.success('Ödeme onaylandı')
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Ödeme onaylanamadı'))
    } finally {
      setConfirming(false)
    }
  }

  const giveUp = async () => {
    if (checkoutId) {
      try {
        await cancelCheckout(checkoutId)
      } catch {
        // Vazgeçme başarısız olsa da kullanıcı haritaya dönebilmeli;
        // rezervasyon zaten süresi dolunca serbest kalır.
      }
    }
    sessionStorage.removeItem('waydee-checkout')
    navigate('/map')
  }

  if (error) {
    return (
      <AuthShell title="Ödeme bulunamadı" subtitle="Bu bağlantı geçersiz olabilir.">
        <div className="flex items-start gap-3 rounded-2xl bg-subtle p-4">
          <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <p className="text-sm font-medium leading-relaxed text-muted">{error}</p>
        </div>
        <Button size="lg" className="mt-5 w-full" onClick={() => navigate('/map')}>
          Haritaya dön
        </Button>
      </AuthShell>
    )
  }

  if (!checkout) {
    return (
      <AuthShell title="Ödeme kontrol ediliyor" subtitle="Bir saniye…">
        <div className="flex justify-center py-6">
          <Spinner className="h-7 w-7" />
        </div>
      </AuthShell>
    )
  }

  if (checkout.status === 'PAID') {
    sessionStorage.removeItem('waydee-checkout')
    if (isPlanKind(checkout.kind)) {
      const premium = checkout.kind === 'PLAN_PREMIUM'
      return (
        <AuthShell
          title={premium ? 'Premium aktif' : 'Pro aktif'}
          subtitle={premium ? 'Artık haritada mağaza açabilirsin.' : 'Sınırsız gönderi ve etiket senin.'}
        >
          <div className="flex items-start gap-3 rounded-2xl bg-mint-soft p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <p className="text-sm font-medium leading-relaxed text-ink">
              <span className="font-semibold">{premium ? 'Waydee Premium' : 'Waydee Pro'}</span> ·{' '}
              {checkout.amount} {checkout.currency}
            </p>
          </div>
          <Button size="lg" className="mt-5 w-full" onClick={() => navigate(premium ? '/map' : '/home')}>
            {premium ? 'Mağazamı kur' : 'Devam et'}
          </Button>
        </AuthShell>
      )
    }
    const renewal = checkout.kind === 'TERRITORY_RENEWAL'
    return (
      <AuthShell
        title={renewal ? 'Kiran uzatıldı' : 'Bölgen hazır'}
        subtitle={renewal ? 'Bölgen 12 ay daha senin.' : 'Daire haritada senin adına işlendi.'}
      >
        <div className="flex items-start gap-3 rounded-2xl bg-mint-soft p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <p className="text-sm font-medium leading-relaxed text-ink">
            <span className="font-semibold">{checkout.territoryName}</span> ·{' '}
            {checkout.amount} {checkout.currency}
          </p>
        </div>
        {/* Alanı yeni alan kullanıcının kartı artık koordinat ve alan taşıyor. */}
        <Button size="lg" className="mt-5 w-full" onClick={() => navigate('/my-card')}>
          <Share2 className="h-4 w-4" /> Kartımı paylaş
        </Button>
        <Button variant="stroke" size="lg" className="mt-3 w-full" onClick={() => navigate('/map')}>
          Haritaya git
        </Button>
      </AuthShell>
    )
  }

  if (checkout.status === 'FAILED' || checkout.status === 'EXPIRED' || checkout.status === 'CANCELLED') {
    return (
      <AuthShell
        title={checkout.status === 'EXPIRED' ? 'Süre doldu' : 'Ödeme tamamlanmadı'}
        subtitle="Alan yeniden serbest bırakıldı."
      >
        <div className="flex items-start gap-3 rounded-2xl bg-subtle p-4">
          <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <p className="text-sm font-medium leading-relaxed text-muted">
            {checkout.failureReason ?? 'Ödeme alınamadı. Haritadan tekrar deneyebilirsin.'}
          </p>
        </div>
        <Button size="lg" className="mt-5 w-full" onClick={() => navigate('/map')}>
          Haritaya dön
        </Button>
      </AuthShell>
    )
  }

  // PENDING
  return (
    <AuthShell
      title={isMock ? 'Sahte ödeme' : 'Ödeme bekleniyor'}
      subtitle={
        isMock
          ? 'Yerel geliştirme ekranı — gerçek tahsilat yapılmaz.'
          : 'Sağlayıcıdan onay bekliyoruz, bu birkaç saniye sürebilir.'
      }
    >
      <div className="flex items-start gap-3 rounded-2xl bg-subtle p-4">
        <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
        <p className="text-sm font-medium leading-relaxed text-ink">
          {isPlanKind(checkout.kind) ? (
            <span className="font-semibold">
              {checkout.kind === 'PLAN_PREMIUM' ? 'Waydee Premium' : 'Waydee Pro'}
            </span>
          ) : (
            <>
              <span className="font-semibold">{checkout.territoryName}</span>
              <br />
              <span className="text-muted">{checkout.regionLabel}</span>
            </>
          )}
          <br />
          <span className="text-[15px] font-semibold">
            {checkout.amount} {checkout.currency}
          </span>
        </p>
      </div>

      {isMock ? (
        <Button size="lg" className="mt-5 w-full" disabled={confirming} onClick={confirmMock}>
          {confirming ? <Spinner className="border-on-ink/30 border-t-on-ink" /> : 'Ödemeyi onayla (sahte)'}
        </Button>
      ) : (
        <div className="mt-5 flex justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      <Button variant="stroke" size="lg" className="mt-3 w-full" onClick={giveUp}>
        Vazgeç
      </Button>
    </AuthShell>
  )
}
