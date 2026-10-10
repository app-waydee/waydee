import { useEffect, useMemo, useState } from 'react'
import { profilePath } from '@/lib/profilePath'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Radio } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { activityLabel, getRecentActivity } from '@/lib/activity'
import { subscribeActivity } from '@/lib/ws'
import { timeAgo } from '@/lib/format'
import type { ActivityResponse } from '@/types/api'

const MAX_ITEMS = 12
/** Panel yalnız "şu an olan"ı gösterir — daha eskisi akışta yer kaplamasın. */
const WINDOW_MINUTES = 10
const WINDOW_MS = WINDOW_MINUTES * 60_000
const OPEN_KEY = 'waydee-activity-open'

function readOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0'
  } catch {
    return true
  }
}

/**
 * Son hareketler — haritanın sağ-alt yığınında, "Alan al" düğmesinin ÜSTÜNDE
 * duran katlanabilir panel. Konumu MapPage'deki yığın belirler; bu bileşen
 * kendini absolute konumlamaz (eskiden düğmeyle üst üste biniyordu).
 *
 * Yalnız son 10 dakikadaki hareketler gösterilir: sunucu penceresi + istemcide
 * dakikada bir yaşlananları düşüren süzgeç (WS ile gelenler de yaşlanır).
 */
export function ActivityFeed() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(readOpen)
  const [now, setNow] = useState(() => Date.now())

  const query = useQuery({
    queryKey: ['activity', WINDOW_MINUTES],
    queryFn: () => getRecentActivity(MAX_ITEMS, WINDOW_MINUTES),
    refetchInterval: 60_000,
  })

  // Yaşlanan satırlar kendiliğinden düşsün diye saat tik atar.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    return subscribeActivity((live) => {
      queryClient.setQueryData<ActivityResponse[]>(['activity', WINDOW_MINUTES], (old) => {
        const next: ActivityResponse[] = [
          {
            id: live.id,
            type: live.type,
            actorId: live.actorId,
            actorUsername: live.actorUsername,
            actorDisplayName: live.actorDisplayName,
            actorAvatarUrl: live.actorAvatarUrl,
            territoryId: live.territoryId,
            territoryName: live.territoryName,
            createdAt: live.createdAt,
          },
          ...(old ?? []).filter((a) => a.id !== live.id),
        ]
        return next.slice(0, MAX_ITEMS)
      })
      setNow(Date.now())
    })
  }, [queryClient])

  const items = useMemo(
    () => (query.data ?? []).filter((a) => now - new Date(a.createdAt).getTime() <= WINDOW_MS),
    [query.data, now],
  )

  const toggle = (value: boolean) => {
    setOpen(value)
    try {
      localStorage.setItem(OPEN_KEY, value ? '1' : '0')
    } catch {
      /* storage kapalı olabilir */
    }
  }

  if (items.length === 0) return null

  if (!open) {
    return (
      <button
        onClick={() => toggle(true)}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface/95 py-2 pl-3 pr-3.5 shadow-float backdrop-blur transition-colors hover:bg-surface"
        aria-label="Son hareketleri aç"
        aria-expanded={false}
      >
        <Radio className="h-3.5 w-3.5 shrink-0 text-success" />
        <span className="text-[13px] font-semibold">Son hareketler</span>
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-white">
          {items.length}
        </span>
      </button>
    )
  }

  return (
    <div className="pointer-events-auto w-[min(calc(100vw-2rem),18rem)] rounded-card bg-surface/95 p-3 shadow-float backdrop-blur md:w-80 md:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-faint">
          <Radio className="h-3.5 w-3.5 shrink-0 text-success" />
          <span className="truncate">Son hareketler</span>
          <span className="shrink-0 font-medium text-faint">· {WINDOW_MINUTES} dk</span>
        </p>
        <button
          onClick={() => toggle(false)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink"
          aria-label="Son hareketleri kapat"
          aria-expanded
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-52 space-y-0.5 overflow-y-auto overscroll-contain pr-0.5 md:max-h-72 md:space-y-1">
        {items.map((a) => (
          <ActivityRow key={a.id} item={a} />
        ))}
      </div>
    </div>
  )
}

function ActivityRow({ item }: { item: ActivityResponse }) {
  const inner = (
    <>
      <Avatar
        src={item.actorAvatarUrl}
        name={item.actorDisplayName}
        className="h-7 w-7 shrink-0 md:h-8 md:w-8"
      />
      <span className="min-w-0 flex-1 text-[12px] leading-snug md:text-[13px]">
        <b className="font-semibold">{item.actorDisplayName}</b>{' '}
        <span className="font-medium text-muted">{activityLabel(item.type)}</span>
        {item.territoryName && item.type === 'TERRITORY_PURCHASED' && (
          <span className="font-medium text-muted"> · {item.territoryName}</span>
        )}
        <span className="block text-[10px] font-medium text-faint">{timeAgo(item.createdAt)}</span>
      </span>
    </>
  )
  const cls = 'flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-subtle'
  return item.territoryId ? (
    <Link to={`/t/${item.territoryId}`} className={cls}>
      {inner}
    </Link>
  ) : (
    <Link to={profilePath({ username: item.actorUsername, id: item.actorId })} className={cls}>
      {inner}
    </Link>
  )
}
