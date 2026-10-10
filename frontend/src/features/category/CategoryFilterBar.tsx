import { Storefront } from '@phosphor-icons/react'
import { StoreCategoryIcon } from '@/components/StoreCategoryIcon'
import { useStoreCategoryLabel } from '@/lib/storeCategories'
import { useT } from '@/i18n'
import type { StoreCategory } from '@/types/api'

/**
 * <b>Haritanın üstündeki kategori şeridi</b> (V52, 24 Ağu 2026).
 *
 * <p>Kullanıcı ekran görüntüsü verdi: *"haritada fotoğraftaki gibi tasarımın
 * birebir aynısı olacak … mobili ayarlamayı da unutma"*.
 *
 * <h3>🔴 Süzgeç `categoryId` ile yapılır, `categoryCode` ile DEĞİL</h3>
 * <p>Kod, yöneticinin eklediği kategorilerde serbest bir metindir; iki
 * kategorinin kodu birbirine benzeyebilir. Kimlik tekildir.
 *
 * <h3>⚠️ "Tümü" bir kategori DEĞİL</h3>
 * <p>Veritabanında karşılığı yok ve olmamalı: onu bir satır yapmak,
 * yöneticinin onu pasife alıp süzgeci kapatabilmesi demekti. Burada
 * {@code null} ile temsil edilir.
 *
 * <h3>⚠️ Sunucuya gitmez — süzgeç HARİTA KATMANINDA çalışır</h3>
 * <p>Bütün mağazalar zaten tek bir GeoJSON'da geliyor ve o yanıt
 * <b>önbelleklidir</b> (sunucuda {@code @Cacheable}). Kategoriye göre yeni bir
 * istek atmak, önbelleği kategori sayısı kadar bölerdi ve her çip dokunuşu
 * bir gidiş-dönüş beklerdi. Mapbox ifadesi aynı işi kare içinde yapıyor.
 */
interface Props {
  categories: StoreCategory[]
  /** Seçili kategori kimliği; `null` → tümü. */
  value: string | null
  onChange: (categoryId: string | null) => void
  className?: string
}

export function CategoryFilterBar({ categories, value, onChange, className }: Props) {
  const t = useT()
  const label = useStoreCategoryLabel()

  /* ⚠️ Veri yoksa şerit HİÇ çizilmez — boş bir "Tümü" çipi tek başına
     bilgi taşımaz ve haritanın üstünde yer kaplardı. Bu, 90. turun
     *"verisi olmayan kontrol çizilmez"* kuralı. */
  if (categories.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <div className="waydee-cat-bar pointer-events-auto" role="group" aria-label={t('category.filterLabel')}>
        <button
          type="button"
          className="waydee-cat-chip"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
        >
          <span
            className="waydee-cat-chip-icon"
            style={{ background: 'color-mix(in srgb, var(--color-muted) 16%, transparent)' }}
          >
            <Storefront className="h-3.5 w-3.5" weight="duotone" color="var(--color-muted)" />
          </span>
          {t('category.all')}
        </button>

        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className="waydee-cat-chip"
            aria-pressed={value === category.id}
            /* ⚠️ Aynı çipe ikinci dokunuş süzgeci KALDIRIR. Kullanıcı seçtiği
               çipe basınca hiçbir şey olmaması, "nasıl geri alırım" sorusunu
               "Tümü"nü bulmaya bağlardı — şerit kaydırılmışsa o çip ekranda
               bile olmayabilir. */
            onClick={() => onChange(value === category.id ? null : category.id)}
          >
            <span
              className="waydee-cat-chip-icon"
              style={{ background: `color-mix(in srgb, ${category.color} 16%, transparent)` }}
            >
              <StoreCategoryIcon name={category.icon} className="h-3.5 w-3.5" color={category.color} />
            </span>
            {label(category)}
          </button>
        ))}
      </div>
    </div>
  )
}
