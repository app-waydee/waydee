import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Sayfalama — <b>referansla birebir</b>.
 *
 * <p>Referans (taginbio) HeroUI kullanıyor ve paketten okunan prop'lar şunlar:
 * `isCompact` · `showControls` · `radius="sm"` · `color="default"` ·
 * `showShadow={false}` · `className="mt-4"`. Yani:
 * <ul>
 *   <li><b>compact</b> = düğmeler bitişik, aralarında boşluk yok</li>
 *   <li><b>showControls</b> = başta/sonda chevron düğmeleri</li>
 *   <li>seçili sayfa <b>koyu dolgulu</b>, diğerleri saydam</li>
 *   <li>radius <b>sm</b> = 8px (yuvarlak değil, hafif köşeli kare)</li>
 * </ul>
 *
 * ⚠️ Ekran görüntülerinde <b>tek sayfa varken bile</b> sayfalama çiziliyor
 * (boş "No links" ekranında da chevron'lar duruyor) — bu yüzden bileşen
 * `total < 2` diye kendini gizlemez. Kullanıcı bunu kırmızı okla ayrıca
 * işaretledi.
 */
export function Pagination({
  page,
  totalPages,
  onChange,
  className = '',
}: {
  /** 1 tabanlı — referansın `page` prop'u da 1 tabanlıdır. */
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}) {
  const total = Math.max(totalPages, 0)
  const pages = Array.from({ length: total }, (_, i) => i + 1)
  const canPrev = page > 1
  const canNext = page < total

  return (
    <nav className={`waydee-pager ${className}`} aria-label="pagination">
      <button
        type="button"
        className="waydee-pager-btn"
        disabled={!canPrev}
        onClick={() => canPrev && onChange(page - 1)}
        aria-label="previous page"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-current={p === page ? 'page' : undefined}
          className={`waydee-pager-btn ${p === page ? 'waydee-pager-on' : ''}`}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        className="waydee-pager-btn"
        disabled={!canNext}
        onClick={() => canNext && onChange(page + 1)}
        aria-label="next page"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
      </button>
    </nav>
  )
}
