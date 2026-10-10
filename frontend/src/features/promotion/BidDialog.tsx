import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Crown, Loader2, Rocket } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'
import { getBidBoard, placeBid, formatMoney } from '@/lib/storeBids'
import { useI18nStore } from '@/stores/i18n'
import { useT } from '@/i18n'

/**
 * <b>Teklif penceresi</b> — "mağazanı öne taşı" (98. tur).
 *
 * <h3>🔴 Tutarı kullanıcı yazar</h3>
 * <p>Bu üründe fiyat listesi yok: fiyat, listede olmak isteyenin ödemeye razı
 * olduğu tutardır (bidkick modeli). Sınırlar <b>sunucudan</b> gelir
 * ({@code minBid}/{@code maxBid}) — istemcide sabit yazsaydık, sunucu sınırı
 * değiştiğinde kullanıcı "geçerli" bir tutarla 400 alırdı.
 *
 * <h3>⚠️ Mağazası olmayan buraya kadar gelmemeli</h3>
 * <p>Kapı sunucuda ({@code requireStoreFor}) ama pencere de açıkça söyler ve
 * mağaza kurulumuna yönlendirir: "önce mağaza aç" cümlesini ancak ödeme
 * ekranında görmek, kullanıcıyı boş yere ödeme akışına sokmak olurdu.
 *
 * <h3>⚠️ Ödeme sayfasına YÖNLENDİRME</h3>
 * <p>Sıraya girme burada olmaz — sunucu bir ödeme adresi döner ve tarayıcı
 * oraya gider. Plan yükseltmesindeki akışla birebir aynı (`useUpgrade`).
 */
export function BidDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const locale = useI18nStore((s) => s.locale)
  const { data } = useQuery({ queryKey: ['bid-board'], queryFn: getBidBoard, staleTime: 30_000 })
  const me = data?.me

  /**
   * Kutudaki metin — <b>her zaman string</b>.
   *
   * 🔴 25 Ağu 2026 üretim hatası: *"Lidere geçmek için $201"* düğmesi
   * sunucudan gelen **sayıyı** doğrudan bu state'e yazıyordu ve bir sonraki
   * `amount.trim()` çağrısı `o.trim is not a function` ile bütün ekranı
   * düşürüyordu. Tip yalanı derleyiciyi geçmişti (bkz. `lib/storeBids.ts`).
   *
   * ⚠️ Sunucudan gelen her tutar **sayıdır**; kutuya konurken açıkça
   * `String(...)` ile çevrilir, okunurken `Number(...)` ile geri alınır.
   */
  const [amount, setAmount] = useState<string>('')
  const suggested = me?.amountToLead ?? 5
  const typed = amount.trim()
  const value = typed === '' ? String(suggested) : typed

  const bid = useMutation({
    mutationFn: () => placeBid(Number(value)),
    onSuccess: (res) => {
      if (res.checkoutUrl) window.location.assign(res.checkoutUrl)
      else toast.error(t('bid.failed'))
    },
    onError: (e) => toast.error(apiErrorMessage(e) || t('bid.failed')),
  })

  const money = (v: number | string) => formatMoney(v, data?.currency ?? 'TRY', locale)

  const numeric = Number(value)
  const min = Number(me?.minBid ?? 5)
  const max = Number(me?.maxBid ?? 999999)
  const invalid = !Number.isFinite(numeric) || numeric < min || numeric > max

  return (
    <Dialog open onClose={onClose} title={t('bid.promote')}>
      <div className="space-y-4">
        <p className="text-[13.5px] font-medium leading-snug text-muted">{t('bid.explain')}</p>

        {/* Şu anki durum */}
        <div className="rounded-2xl border border-line bg-subtle/60 p-3">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
            <Crown className="h-3.5 w-3.5" />
            {data?.rows.length
              ? t('bid.currentLeader', {
                  name: data.rows[0].storeName,
                  amount: money(data.rows[0].amount),
                })
              : t('bid.noLeader')}
          </p>
          {me?.amount && (
            <p className="mt-1 text-[12.5px] font-semibold text-ink">
              {t('bid.yourCurrent', { amount: money(me.amount), rank: String(me.rank ?? 0) })}
            </p>
          )}
        </div>

        {me && !me.hasStore ? (
          /* 🔴 Mağazası yoksa ödeme akışına HİÇ sokulmaz. */
          <div className="rounded-2xl border border-line p-4 text-center">
            <p className="text-[13.5px] font-semibold">{t('bid.needStore')}</p>
            <Button
              className="mt-3"
              onClick={() => {
                onClose()
                navigate('/map')
              }}
            >
              {t('bid.openStore')}
            </Button>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="bid-amount" className="mb-1 block text-[13px] font-semibold">
                {t('bid.amountLabel')}
              </label>
              <Input
                id="bid-amount"
                inputMode="decimal"
                value={amount}
                placeholder={String(suggested)}
                onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
              />
              <p className="mt-1.5 text-[12px] font-medium text-faint">
                {t('bid.limits', { min: money(min), max: money(max) })}
              </p>
              {/* ⚠️ "Lidere geçmek için X" sunucudan gelir; istemcide
                  hesaplasaydık iki ekran iki farklı sayı gösterebilirdi. */}
              <button
                type="button"
                className="mt-2 text-[12.5px] font-bold text-brand underline-offset-2 hover:underline"
                /* ⚠️ `String(...)` ŞART — gerekçe state'in tanımında. */
                onClick={() => setAmount(String(suggested))}
              >
                {t('bid.useLeadAmount', { amount: money(suggested) })}
              </button>
            </div>

            <p className="text-[12px] font-medium leading-snug text-faint">{t('bid.finalNote')}</p>

            <div className="flex gap-2">
              <Button variant="stroke" className="flex-1" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                className="flex-1"
                disabled={invalid || bid.isPending}
                onClick={() => bid.mutate()}
              >
                {bid.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {t('bid.payAndRise')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
