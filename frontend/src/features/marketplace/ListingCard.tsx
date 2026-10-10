import { motion } from 'framer-motion'
import { Heart, Sparkles, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import type { ListingResponse } from '@/lib/marketplace'

/** Kategori → pastel karo. Sunucudan gelen kodla eşlenir. */
const CATEGORY_TONES: Record<string, string> = {
  STARTUP: 'bg-lilac-soft text-[#6c3ee8]',
  ECOMMERCE: 'bg-sky-soft text-[#0f78bd]',
  FOOD: 'bg-peach-soft text-[#e2402a]',
  ART: 'bg-sand-soft text-[#b57200]',
  SERVICE: 'bg-mint-soft text-[#4f9e33]',
  TECH: 'bg-sky-soft text-[#0f78bd]',
  EDUCATION: 'bg-lilac-soft text-[#6c3ee8]',
  HEALTH: 'bg-mint-soft text-[#4f9e33]',
  TRAVEL: 'bg-sand-soft text-[#b57200]',
  OTHER: 'bg-subtle text-muted',
}

interface ListingCardProps {
  listing: ListingResponse
  onOpen: (listing: ListingResponse) => void
  onLike?: (listing: ListingResponse) => void
  /** Izgarada sırayla belirsin diye gecikme. */
  index?: number
}

/**
 * <b>Pazar yeri stant kartı.</b>
 *
 * <p>🔴 16 Ağu 2026 — kart, pazar yeri karosuyla (`waydee-market-*`) AYNI
 * iskelete alındı. Eskiden kendi `rounded-card bg-surface shadow-card`
 * kutusunu kuruyordu; aynı ızgarada duran iki kart türü (pazar ve stant)
 * birbirinden farklı köşe, zemin ve gölge taşıyordu.
 *
 * <p>⚠️ Giriş animasyonu YALNIZ `opacity`. Kartlar ızgarada konumlanır ve
 * framer-motion v12 + React 19'da `y` animasyonu başlangıç değerinde
 * takılabiliyor (vault tuzağı) — ızgara kalıcı kayık görünürdü.
 * Hareket hissi hover'daki CSS `translate`/`scale` ile veriliyor.
 *
 * <p>⚠️ Erişilebilirlik metinleri sözlükten gelir; eskiden sabit Türkçeydi
 * ("Beğen" / "… detayını aç") ve ekran okuyucu beş dilin hepsinde Türkçe
 * okuyordu.
 */
export function ListingCard({ listing, onOpen, onLike, index = 0 }: ListingCardProps) {
  const t = useT()
  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
      className="waydee-market-card"
    >
      {/*
        🔴 KAPAK BANDI KALDIRILDI (16 Ağu, ikinci geçiş) — pazar kartıyla aynı
        gerekçe. Stantın <b>logosu</b> duruyor: o dekorasyon değil, markanın
        kendisi. Kapak fotoğrafı ise stant detayı penceresinde tam boy görünür;
        ızgarada 16:9 küçültülmüş bir kopyasını taşımak bilgi katmıyordu.
      */}
      <button
        type="button"
        onClick={() => onOpen(listing)}
        className="waydee-market-body"
        aria-label={t('market.openDetail', { name: listing.title })}
      >
        <span className="waydee-market-top">
          <span className="waydee-market-mark">
            {listing.logoUrl ? (
              <img src={listing.logoUrl} alt="" loading="lazy" />
            ) : (
              listing.title.charAt(0).toUpperCase()
            )}
          </span>
          <span className="waydee-market-text">
            <span className="waydee-market-name">{listing.title}</span>
            <span className="waydee-market-tagline">{listing.tagline ?? ''}</span>
          </span>
        </span>

        <span className="waydee-market-meta">
          {/* Kategori tek renkli çip olarak kaldı: bu bir SINIFLANDIRMADIR,
              rengi bilgi taşır (aynı kategori her yerde aynı ton). */}
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 font-semibold',
              CATEGORY_TONES[listing.category] ?? CATEGORY_TONES.OTHER,
            )}
          >
            {listing.categoryLabel}
          </span>
          {listing.stageLabel && <span>{listing.stageLabel}</span>}
          {listing.teamSize && (
            <span>
              <Users className="h-3 w-3" /> {listing.teamSize}
            </span>
          )}
          {listing.featured && (
            <span className="waydee-market-state" data-tone="full">
              <Sparkles className="h-3 w-3" /> {t('market.featured')}
            </span>
          )}
        </span>
      </button>

      {/* alt şerit: sahip + beğeni */}
      <div className="waydee-market-foot">
        <Avatar src={listing.owner.avatarUrl} name={listing.owner.displayName} className="h-6 w-6 shrink-0" />
        <span className="waydee-market-owner">@{listing.owner.username}</span>
        <button
          type="button"
          onClick={() => onLike?.(listing)}
          disabled={!onLike}
          aria-pressed={listing.likedByMe}
          aria-label={listing.likedByMe ? t('market.unlike') : t('market.like')}
          className="waydee-market-like"
        >
          <Heart className={cn('h-3.5 w-3.5', listing.likedByMe && 'fill-current')} />
          {listing.likeCount}
        </button>
      </div>
    </motion.article>
  )
}
