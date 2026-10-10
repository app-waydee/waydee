import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Lock, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TerritoryCard } from '@/features/map/TerritoryCard'
import type { TerritoryProperties } from '@/types/api'

/**
 * Vitrin haritasındaki bölge kartı.
 *
 * Kimliği MASKELENMEMİŞ (açık hesap) bölgelerde oturumlu haritayla **aynı zengin
 * kart** gösterilir — tek fark, verinin `/public/**` ucundan gelmesi ve
 * takip/mesaj gibi eylemlerin yerini "giriş yap" çağrısının almasıdır.
 * İki ayrı kart tasarımı tutmak, alan eklendikçe birinin geride kalmasına yol
 * açıyordu (vault: "harita davranışı = beş yüzey" tuzağının kart hâli).
 *
 * Maskeli bölgelerde (gizli hesap / rezerve alan) sunucu zaten profil ucuna
 * 403 verir; o durumda zengin kart çağrılmaz, kısa bir bilgi kartı çıkar.
 */
export function PublicTerritoryCard({
  territory,
  onClose,
  anchored = false,
}: {
  territory: TerritoryProperties
  onClose: () => void
  /**
   * Kart dairenin merkezine çapalanmış mı. Koordinat burada TAŞINMAZ — konumu
   * saran öğe doğrudan DOM'a yazar (bkz. `TerritoryCard` `anchored` notu).
   */
  anchored?: boolean
}) {
  // ownerId boşsa sunucu kimliği maskelemiştir (gizli hesap ya da rezerve alan).
  const masked = !territory.ownerId
  const reserved = Boolean((territory as unknown as { reserved?: boolean }).reserved)

  if (!masked) {
    return (
      <TerritoryCard
        territory={territory}
        onClose={onClose}
        anchored={anchored}
        variant="public"
        hrefs={{ profile: (username: string) => `/${username}` }}
      />
    )
  }

  return (
    <motion.div
      /* Konum kritik: transform animasyonu YOK, yalnız opacity (vault kuralı).
         Çapalıyken konum ve ortalama saran öğenin transform'undadır. */
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className={
        anchored
          ? 'pointer-events-auto z-30 w-[320px] max-w-[calc(100vw-2rem)] rounded-card bg-surface p-5 shadow-float md:w-[340px] md:p-6'
          : 'pointer-events-auto fixed bottom-20 left-4 z-30 w-[320px] max-w-[calc(100vw-2rem)] rounded-card bg-surface p-5 shadow-float md:w-[340px] md:p-6'
      }
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <Badge tone={reserved ? 'warning' : 'neutral'}>{reserved ? 'Kurum alanı' : 'Gizli hesap'}</Badge>
        <Button variant="stroke" size="icon-sm" onClick={onClose} aria-label="Kapat">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Avatar src={null} name={territory.ownerDisplayName} className="h-12 w-12 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold leading-tight tracking-tight">{territory.name}</span>
          <span className="block truncate text-[13px] font-semibold text-faint">{territory.ownerDisplayName}</span>
        </span>
      </div>

      <p className="mt-4 flex items-center gap-2 rounded-2xl bg-subtle px-3.5 py-3 text-[13px] font-medium text-muted">
        <Lock className="h-4 w-4 shrink-0" />
        {reserved ? 'Bu alan rezerve edilmiş.' : 'Bu hesap gizli — profili görmek için giriş yap.'}
      </p>

      {!reserved && (
        <Link to="/login" className="mt-4 block">
          <Button className="w-full justify-center">Giriş yap</Button>
        </Link>
      )}
    </motion.div>
  )
}
