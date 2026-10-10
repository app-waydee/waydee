import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import { useI18nStore } from '@/stores/i18n'
import { ArrowRight, Heart, Store, Users, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MarketplaceAreaProperties, StallProperties } from '@/lib/marketplace'

/**
 * Haritada pazar alanına ya da stanta tıklayınca açılan kart.
 *
 * Bölge kartıyla aynı dil, ayrı bileşen: pazar/stant alanları bölgeninkilerden
 * tamamen farklı ve tek bir karta ikisini sığdırmak her iki tarafı da bozardı.
 *
 * ⚠️ Yalnız `opacity` animasyonu — konum kritik (vault transform tuzağı).
 */
export function MarketplaceMapCard({
  area,
  stall,
  onClose,
}: {
  area?: MarketplaceAreaProperties | null
  stall?: StallProperties | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const t = useT()
  /* Sayı biçimi de dile bağlı: 'tr-TR' sabiti İngilizce arayüzde
     "37.909" gibi Türkçe ayraçlı bir sayı gösteriyordu. */
  const locale = useI18nStore((s) => s.locale)
  if (!area && !stall) return null

  const accent = stall?.accentColor ?? area?.accentColor ?? '#8e59ff'
  const slug = stall?.marketplaceSlug ?? area?.slug

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      /*
        🔴 15 Ağu 2026 — KART KENAR ÇUBUĞUNUN ALTINDA KALIYORDU.

        `fixed left-4` konumu **viewport**e göredir: kartın sol 64px'i,
        80px genişliğindeki masaüstü kenar çubuğunun ARDINDA kalıyordu
        (ekran görüntüsüyle bildirildi). Mobilde çubuk gizli olduğu için
        sorun yalnız masaüstünde görünüyordu.

        ⚠️ `absolute` yapmak çözüm DEĞİL: kart `fixed` çünkü `waydee-above-nav`
        ile alt çubuğun üstüne oturuyor. Doğru düzeltme, masaüstünde çubuğun
        genişliği kadar sağa kaydırmak: 80px çubuk + 16px nefes payı = 96px.
      */
      className="waydee-above-nav pointer-events-auto fixed left-4 z-30 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card bg-surface shadow-float md:left-24 md:w-[340px]"
    >
      <div className="h-1.5 w-full" style={{ background: accent }} aria-hidden />
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <Badge tone="violet">
            <Store className="h-3 w-3" /> {stall ? 'Stant' : 'Pazar yeri'}
          </Badge>
          <Button variant="stroke" size="icon-sm" onClick={onClose} aria-label="Kapat">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {stall ? (
          <>
            <div className="flex items-center gap-3">
              {stall.logoUrl ? (
                <img src={stall.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-subtle text-[17px] font-semibold text-muted">
                  {stall.title.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold leading-tight tracking-tight">
                  {stall.title}
                </span>
                <span className="block truncate text-[12.5px] font-semibold text-accent">
                  @{stall.ownerUsername}
                </span>
              </span>
            </div>
            {stall.tagline && <p className="mt-3 text-[13px] leading-snug text-muted">{stall.tagline}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral">{stall.categoryLabel}</Badge>
              {stall.featured && <Badge tone="info">{t('mapCard.featured')}</Badge>}
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-danger">
                <Heart className="h-3.5 w-3.5" /> {stall.likeCount}
              </span>
            </div>
            <p className="mt-3 truncate text-[12.5px] font-medium text-faint">
              {t('mapCard.inMarketplace').replace('{name}', stall.marketplaceName)}
            </p>
          </>
        ) : (
          <>
            <h3 className="truncate text-[18px] font-semibold leading-tight tracking-tight">{area!.name}</h3>
            {area!.tagline && <p className="mt-1.5 text-[13px] leading-snug text-muted">{area!.tagline}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px] font-medium text-faint">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />{' '}
                {t('mapCard.stalls').replace('{n}', String(area!.listingCount))}
              </span>
              <span>{Math.round(area!.areaKm2).toLocaleString(locale)} km²</span>
              {area!.accepting ? (
                <Badge tone="success">{t('mapCard.open')}</Badge>
              ) : (
                <Badge tone="neutral">{t('mapCard.closed')}</Badge>
              )}
            </div>
          </>
        )}

        <Button className="mt-5 w-full justify-center" onClick={() => slug && navigate(`/market/${slug}`)}>
          {t('mapCard.openMarketplace')} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}
