import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Crown, Rocket } from 'lucide-react'
import { getBidBoard, formatMoney } from '@/lib/storeBids'
import { useI18nStore } from '@/stores/i18n'
import { useT } from '@/i18n'
import { BidDialog } from './BidDialog'

/**
 * <b>"Mağazanı öne taşı" kartı</b> — ana sayfada paket rozetinin SAĞINDA
 * (98. tur, kullanıcı isteği).
 *
 * <p>🔴 Neden tam olarak orası: paket rozeti kullanıcının "neyim var"
 * cümlesidir; öne çıkarma ise "daha ne alabilirim" cümlesi. İkisi yan yana
 * durunca ikinci soru birincinin doğal devamı olur. Ayrı bir bölüm açmak
 * akışın ortasına reklam koymak gibi okunurdu.
 *
 * <p>⚠️ Kart <b>durumu gösterir</b>, boş bir çağrı değildir: sırada olan
 * kullanıcı kaçıncı olduğunu, olmayan ise lider olmak için gereken tutarı
 * görür. "Öne çık" yazan ama hiçbir sayı taşımayan bir düğme, tıklanmadan
 * anlaşılmazdı.
 *
 * <p>⚠️ Mağazası olmayan kullanıcıya <b>çizilmez</b>: satın alamayacağı bir
 * şeyin reklamı, ana sayfada yer kaplayan bir hayal kırıklığıdır. (Pencere
 * yine de mağaza kurulumuna yönlendiriyor — harita tarafından açıldığında.)
 */
export function PromoteCard() {
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const [open, setOpen] = useState(false)

  const { data } = useQuery({ queryKey: ['bid-board'], queryFn: getBidBoard, staleTime: 60_000 })
  const me = data?.me
  if (!me?.hasStore) return null

  const money = (v: number) => formatMoney(v, data?.currency ?? 'TRY', locale)

  return (
    <>
      <button type="button" className="waydee-promote-card" onClick={() => setOpen(true)}>
        <span className="waydee-promote-icon">
          {me.rank ? <Crown className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
        </span>
        <span className="min-w-0 text-start">
          <span className="block truncate text-[12.5px] font-black leading-tight">
            {t('bid.cardTitle')}
          </span>
          <span className="block truncate text-[11.5px] font-semibold text-muted">
            {me.rank
              ? t('bid.cardRank', { rank: String(me.rank) })
              : t('bid.useLeadAmount', { amount: money(me.amountToLead) })}
          </span>
        </span>
      </button>
      {open && <BidDialog onClose={() => setOpen(false)} />}
    </>
  )
}
