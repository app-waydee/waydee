import { useEffect, useState } from 'react'
import { profilePath } from '@/lib/profilePath'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowUpRight, ChevronRight, Flame, Sparkles, TrendingUp, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { getTrending, type TrendingItem } from '@/lib/discovery'

const STORAGE_KEY = 'waydee-trending-open'
/** Şerit kaç saniyede bir sıradaki duyuruya geçsin. */
const ROTATE_MS = 6000

interface TrendingBarProps {
  /** Haritada bir daireye uçmak için (yalnız harita yüzeyinde verilir). */
  onFlyTo?: (lng: number, lat: number) => void
  className?: string
}

/**
 * "Yükselişte" duyuru şeridi.
 *
 * Tek satırlık, kendi kendine dönen bir kapsül: haritanın üstünde yer kaplamadan
 * o an yükselen daire/profili duyurur. Dokununca tam liste açılır.
 *
 * Neden dönen tek satır: harita ana yüzey; sabit bir liste tuvali kapatırdı.
 * Neden kapatılabilir: duyuru bir yardımcıdır, dayatma değil — tercih
 * `localStorage`'da kalıcıdır.
 *
 * ⚠️ Animasyon YALNIZ opacity (vault transform tuzağı) — kapsül yüzen bir
 * öğedir ve `y`/`x` animasyonu başlangıç değerinde takılıyor.
 */
export function TrendingBar({ onFlyTo, className }: TrendingBarProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'false')
  const [expanded, setExpanded] = useState(false)
  const [index, setIndex] = useState(0)

  const { data } = useQuery({
    queryKey: ['trending'],
    queryFn: () => getTrending(8),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  })

  // Daireler ve profiller tek akışta dönüyor — kullanıcı için ikisi de "yükselişte".
  const items: TrendingItem[] = [...(data?.territories ?? []), ...(data?.users ?? [])]

  useEffect(() => {
    if (!open || items.length < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [open, items.length])

  // Liste kısalırsa indeks taşmasın.
  useEffect(() => {
    if (index >= items.length) setIndex(0)
  }, [items.length, index])

  const openItem = (item: TrendingItem) => {
    setExpanded(false)
    if (item.type === 'TERRITORY') {
      if (onFlyTo && item.lng != null && item.lat != null) onFlyTo(item.lng, item.lat)
      else navigate(`/t/${item.id}`)
    } else {
      // 🔴 Köprü YOK: profil adı geldiyse doğrudan /{username}.
      navigate(profilePath(item))
    }
  }

  if (!items.length) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          localStorage.setItem(STORAGE_KEY, 'true')
        }}
        aria-label="Yükselişte olanları göster"
        className={cn(
          'pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-surface/92 px-3 py-2 text-[12.5px] font-semibold text-muted shadow-float backdrop-blur transition-colors hover:text-ink',
          className,
        )}
      >
        <Flame className="h-3.5 w-3.5 text-warn" /> {items.length}
      </button>
    )
  }

  const item = items[index] ?? items[0]

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-surface/94 py-1.5 pl-2 pr-1.5 shadow-float backdrop-blur-xl',
          className,
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sand-soft text-[#b57200]">
          <Flame className="h-3.5 w-3.5" />
        </span>

        <button
          type="button"
          onClick={() => openItem(item)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          title={`${item.title} — ${item.reason}`}
        >
          <Avatar src={item.avatarUrl} name={item.title} className="h-6 w-6 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1">
              <span className="truncate text-[13px] font-semibold leading-tight">{item.title}</span>
              <ClimbBadge climb={item.climb} />
            </span>
            <span className="block truncate text-[11px] font-medium text-faint">{item.reason}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Tüm yükselişte olanlar"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-subtle hover:text-ink"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            localStorage.setItem(STORAGE_KEY, 'false')
          }}
          aria-label="Duyuruları gizle"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-subtle hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>

      {expanded && (
        <Dialog open onClose={() => setExpanded(false)} title="Yükselişte">
          <div className="space-y-5">
            <TrendSection
              title="Daireler"
              icon={TrendingUp}
              items={data?.territories ?? []}
              onOpen={openItem}
            />
            <TrendSection title="Profiller" icon={Sparkles} items={data?.users ?? []} onOpen={openItem} />
            <p className="rounded-2xl bg-subtle px-3.5 py-3 text-[12px] leading-relaxed text-faint">
              Sıralama son 7 günün görüntülenme, beğeni, kaydetme, gönderi ve yeni takipçi
              sinyallerinden hesaplanır. Son 48 saatteki hareket daha ağır sayılır, böylece
              <strong className="font-semibold text-muted"> toplamda popüler olan değil, şu an yükselen</strong> öne çıkar.
            </p>
          </div>
        </Dialog>
      )}
    </>
  )
}

function TrendSection({
  title,
  icon: Icon,
  items,
  onOpen,
}: {
  title: string
  icon: typeof Flame
  items: TrendingItem[]
  onOpen: (i: TrendingItem) => void
}) {
  if (!items.length) return null
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
        <Icon className="h-4 w-4" /> {title}
      </h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={`${item.type}-${item.id}`}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-subtle"
            >
              <span className="w-5 shrink-0 text-center text-[13px] font-semibold tabular-nums text-faint">
                {item.rank}
              </span>
              <Avatar src={item.avatarUrl} name={item.title} className="h-9 w-9 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold leading-tight">{item.title}</span>
                  <ClimbBadge climb={item.climb} />
                </span>
                <span className="block truncate text-[12px] font-medium text-faint">
                  {item.subtitle} · {item.reason}
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-faint" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Sıra değişimi rozeti — yeni girenler ayrı işaretlenir. */
function ClimbBadge({ climb }: { climb: number | null }) {
  if (climb === null) {
    return (
      <span className="shrink-0 rounded-md bg-sky-soft px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#0f78bd]">
        YENİ
      </span>
    )
  }
  if (climb <= 0) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-mint-soft px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#4f9e33]">
      ▲{climb}
    </span>
  )
}
