import { motion } from 'framer-motion'
import { Palette, X } from 'lucide-react'
import { StoreSettingsForm } from '@/features/store/StoreSettingsForm'
import { useT } from '@/i18n'
import type { TerritoryResponse } from '@/types/api'
import type { TerritoryStyleDraft } from './TerritoryStylePicker'

/**
 * <b>Mağaza düzenleme paneli</b> (21 Ağu 2026).
 *
 * <p>Kullanıcı talimatı: *"haritaya mağazası açık olanlara mağazanı düzenle
 * geliştirmesi de yap"*.
 *
 * <h3>🔴 Neden ayrı bir SAYFA değil, haritanın üstünde bir panel</h3>
 * <p>Düzenlenen şey <b>haritadaki işaretçidir</b>. Ayrı bir sayfa, kullanıcıyı
 * düzenlediği nesneden koparır ve her renk denemesinde gidip gelmesini
 * isterdi. Panel haritanın üstünde durur ve <b>her değişiklik anında gerçek
 * işaretçiye uygulanır</b> — önizleme bir kutucuk değil, mağazasının kendisi.
 *
 * <h3>🔴 24 Ağu 2026 — ALANLAR BURADAN ÇIKARILDI</h3>
 * <p>Aynı ayarlar artık {@code /me}'deki mağaza penceresinde de düzenleniyor
 * (kullanıcı isteği: *"me kısmında mağaza kısmına da tüm ayarları taşı"*).
 * Formu iki yerde yazmak, bu projede defalarca yaşanmış *"birinde
 * değiştirdim, diğerini unuttum"* hatasını davet ederdi. Bu dosyada artık
 * yalnız <b>panelin kabuğu</b> var; alanlar {@link StoreSettingsForm}'da ve
 * tek kopya.
 *
 * <h3>⚠️ Önizleme YEREL, kayıt SUNUCUDA</h3>
 * <p>{@code onPreview} yalnız haritanın kaynağındaki özellikleri yerinde
 * değiştirir; hiçbir şey kaydetmez. Panel <b>kaydetmeden</b> kapanırsa
 * {@code onPreview(null)} çağrılır ve harita sunucudaki gerçeğe döner — yani
 * "vazgeç" gerçekten vazgeçmektir.
 */
interface Props {
  store: TerritoryResponse
  /** Sunucunun çözdüğü GERÇEK renk (kullanıcı seçmediyse otomatik palet rengi). */
  currentColor: string
  onClose: () => void
  /** Taslağı haritadaki gerçek işaretçiye uygular; `null` → sunucudaki hâline dön. */
  onPreview: (draft: TerritoryStyleDraft | null) => void
}

export function StoreEditPanel({ store, currentColor, onClose, onPreview }: Props) {
  const t = useT()

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-end justify-center md:items-center md:justify-end md:pe-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="waydee-store-panel pointer-events-auto"
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Palette className="h-4 w-4 shrink-0 text-muted" />
            <p className="truncate text-[15px] font-bold">{t('storeEdit.title')}</p>
          </div>
          <button
            type="button"
            className="rounded-full p-1 text-muted hover:text-ink"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-4">
          <StoreSettingsForm
            store={store}
            currentColor={currentColor}
            onPreview={onPreview}
            onDone={onClose}
            /* Mağaza silinince panel kapanır; harita verisi zaten formda
               tazeleniyor, yani işaretçi de kaybolur. */
            onDeleted={onClose}
          />
        </div>
      </motion.div>
    </div>
  )
}
