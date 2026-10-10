import { useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export interface BarPoint {
  /** X ekseni etiketi (kısa). */
  label: string
  value: number
  /** İpucunda gösterilecek uzun etiket (yoksa `label` kullanılır). */
  title?: string
}

/**
 * Bağımlılıksız sütun grafik.
 *
 * Neden yeniden yazıldı (29 Tem 2026): eski grafik değerlerin çoğu 0 olduğunda
 * çubukları `%2 yükseklik + %22 opaklık` ile çiziyordu → ekran **bomboş** görünüyordu.
 * Bu sürümde:
 *  - her sütunun **hep görünen bir kanalı** (track) var → veri seyrek olsa da grafik okunur,
 *  - **yatay kılavuz çizgileri** ve **Y ekseni** değerleri var,
 *  - sıfır değer "yok" olarak değil, boş kanal olarak görünür,
 *  - üzerine gelince (ve dokununca) değer balonu çıkar,
 *  - hiç veri yoksa grafik yerine açık bir **boş durum** yazısı basılır.
 */
export function BarChart({
  data,
  height = 168,
  formatValue = (v) => v.toLocaleString('tr-TR'),
  emptyLabel = 'Bu dönemde veri yok',
  className,
}: {
  data: BarPoint[]
  height?: number
  formatValue?: (v: number) => string
  emptyLabel?: string
  className?: string
}) {
  const id = useId()
  const [hover, setHover] = useState<number | null>(null)

  const { max, ticks, hasData } = useMemo(() => {
    const peak = Math.max(0, ...data.map((d) => d.value))
    const hasAny = peak > 0
    // Üst sınırı "yuvarlak" bir sayıya çıkar → kılavuz değerleri okunaklı olsun.
    const top = hasAny ? niceCeil(peak) : 1
    return { max: top, ticks: [top, Math.round(top / 2), 0], hasData: hasAny }
  }, [data])

  if (data.length === 0) {
    return <EmptyState label={emptyLabel} height={height} />
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="flex gap-2">
        {/* Y ekseni */}
        <div
          className="flex w-9 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] font-medium tabular-nums text-faint"
          style={{ height }}
          aria-hidden
        >
          {ticks.map((t) => (
            <span key={t}>{hasData ? formatValue(t) : ''}</span>
          ))}
        </div>

        {/* Çizim alanı */}
        <div className="relative min-w-0 flex-1" style={{ height }}>
          {/* Kılavuz çizgileri */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="h-px w-full bg-line" />
            ))}
          </div>

          <div className="relative flex h-full items-end gap-[3px]">
            {data.map((d, i) => {
              const pct = max > 0 ? (d.value / max) * 100 : 0
              const active = hover === i
              return (
                <div
                  key={`${id}-${d.label}-${i}`}
                  className="relative flex h-full min-w-0 flex-1 items-end"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover((h) => (h === i ? null : h))}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.title ?? d.label}: ${formatValue(d.value)}`}
                >
                  {/* Kanal — veri 0 olsa bile grafiğin iskeleti görünür kalır */}
                  <div className="absolute inset-0 rounded-[4px] bg-subtle" />
                  <div
                    className={cn(
                      'relative w-full rounded-[4px] transition-all',
                      active ? 'bg-accent-strong' : 'bg-accent',
                    )}
                    style={{ height: `${d.value > 0 ? Math.max(pct, 3) : 0}%` }}
                  />
                  {active && (
                    <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] font-semibold text-on-ink shadow-float">
                      {d.title ?? d.label} · {formatValue(d.value)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* X ekseni — kalabalıklaşmasın diye seyreltilmiş etiketler */}
      <div className="mt-1.5 flex gap-[3px] pl-11">
        {data.map((d, i) => (
          <span
            key={`${id}-x-${d.label}-${i}`}
            className="min-w-0 flex-1 truncate text-center text-[10px] font-medium text-faint"
          >
            {labelEvery(data.length) === 0 || i % labelEvery(data.length) === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ label, height }: { label: string; height: number }) {
  return (
    <div
      className="grid place-items-center rounded-xl border border-dashed border-line bg-subtle/40"
      style={{ height }}
    >
      <p className="px-4 text-center text-xs font-medium text-faint">{label}</p>
    </div>
  )
}

/** Etiketleri seyrelt: en fazla ~8 etiket göster. */
function labelEvery(count: number) {
  return Math.max(1, Math.ceil(count / 8))
}

/** 7 → 10, 23 → 25, 140 → 150 gibi okunaklı bir üst sınır. */
function niceCeil(value: number) {
  if (value <= 5) return 5
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}
