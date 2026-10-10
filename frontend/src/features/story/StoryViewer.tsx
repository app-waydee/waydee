import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Eye, Loader2, Trash2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { timeAgo } from '@/lib/format'
import { lockScroll } from '@/lib/scrollLock'
import { storyViewers } from '@/lib/social'
import { useT } from '@/i18n'
import type { AuthorSummary, StoryResponse } from '@/types/api'

const DURATION_MS = 5000
const TICK_MS = 50

interface StoryViewerProps {
  author: AuthorSummary
  stories: StoryResponse[]
  startIndex?: number
  onClose: () => void
  onViewed?: (storyId: string) => void
  onDelete?: (storyId: string) => void
}

/** Instagram tarzı tam ekran hikaye görüntüleyici: blur arka plan, ilerleme çubukları,
 *  otomatik geçiş, dokun→gez / basılı tut→duraklat. Tamamen mobil uyumlu. */
export function StoryViewer({ author, stories, startIndex = 0, onClose, onViewed, onDelete }: StoryViewerProps) {
  const t = useT()
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, stories.length - 1)))
  const [progress, setProgress] = useState(0)
  /**
   * 🔴 16 Ağu 2026 — <b>"kimler gördü" sayfası açık mı.</b>
   *
   * <p>Göz simgesi bugüne kadar ölü bir sayaçtı. Artık düğme; açılan sayfa
   * hikayeye bakanları listeler.
   *
   * <p>⚠️ Liste açıkken hikaye <b>DURUR</b> (`sheetOpen` sayacı dondurur).
   * Durmasaydı kullanıcı listeyi okurken hikaye ilerler, beş saniye sonra
   * kapanır ve baktığı liste elinden alınırdı.
   */
  const [sheetOpen, setSheetOpen] = useState(false)
  const pausedRef = useRef(false)
  const viewedRef = useRef<Set<string>>(new Set())
  const downRef = useRef<{ x: number; t: number } | null>(null)
  const current = stories[index]

  /* Hikaye değişince liste kapanır: açık kalsaydı bir öncekinin
     görüntüleyenleri yeni hikayenin üstünde durur, yanlış veri okunurdu. */
  useEffect(() => setSheetOpen(false), [index])

  const advance = useCallback(
    (dir: number) => {
      setIndex((i) => {
        const next = i + dir
        if (next < 0) return 0
        if (next >= stories.length) {
          onClose()
          return i
        }
        return next
      })
    },
    [stories.length, onClose],
  )

  // görüldü işaretle
  useEffect(() => {
    if (current && !viewedRef.current.has(current.id)) {
      viewedRef.current.add(current.id)
      onViewed?.(current.id)
    }
  }, [current, onViewed])

  // ilerleme sayacı (duraklatılabilir)
  useEffect(() => {
    if (!current) return
    setProgress(0)
    const id = window.setInterval(() => {
      // ⚠️ `sheetOpen` de duraklatır — görüntüleyen listesi okunurken hikaye
      //    ilerlemez (bkz. `sheetOpen` notu).
      setProgress((p) =>
        pausedRef.current || sheetOpen ? p : Math.min(100, p + (TICK_MS / DURATION_MS) * 100),
      )
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [index, current, sheetOpen])

  // ilerleme dolunca sonrakine geç
  useEffect(() => {
    if (progress >= 100) advance(1)
  }, [progress, advance])

  // klavye
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* ⚠️ Liste açıkken Escape ÖNCE listeyi kapatır, hikayeyi değil; ok
         tuşları da hikayeyi ilerletmez. Aksi halde listeyi kapatmak isteyen
         kullanıcı tüm görüntüleyiciden çıkardı. */
      if (sheetOpen) {
        if (e.key === 'Escape') setSheetOpen(false)
        return
      }
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') advance(-1)
      else if (e.key === 'ArrowRight') advance(1)
    }
    window.addEventListener('keydown', onKey)
    const release = lockScroll()
    return () => {
      window.removeEventListener('keydown', onKey)
      release()
    }
  }, [advance, onClose, sheetOpen])

  if (!current) return null

  const onPointerDown = (e: ReactPointerEvent) => {
    if (sheetOpen) return
    downRef.current = { x: e.clientX, t: Date.now() }
    pausedRef.current = true
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    /* ⚠️ Liste açıkken görsele dokunmak hikayeyi İLERLETMEZ. Dokunma alanı
       listenin altında kalıyor ve listeyi kapatmak için boşluğa basan
       kullanıcı sonraki hikayeye atlıyordu. */
    if (sheetOpen) return
    pausedRef.current = false
    const d = downRef.current
    downRef.current = null
    if (!d) return
    if (Date.now() - d.t < 250) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const rel = (e.clientX - rect.left) / rect.width
      advance(rel < 0.33 ? -1 : 1)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      {/* blur arka plan */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${current.mediaUrl}")`, filter: 'blur(40px) brightness(0.45)', transform: 'scale(1.25)' }}
      />

      {/* içerik çerçevesi (mobilde tam, masaüstünde dikey kart) */}
      <div className="relative flex h-full w-full max-w-[440px] flex-col sm:h-[92vh] sm:rounded-2xl sm:overflow-hidden">
        {/* ilerleme çubukları */}
        <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 p-3">
          {stories.map((s, i) => (
            <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={{ width: `${i < index ? 100 : i === index ? progress : 0}%`, transition: i === index ? 'width 50ms linear' : 'none' }}
              />
            </div>
          ))}
        </div>

        {/* başlık */}
        <div className="absolute left-0 right-0 top-0 z-20 flex items-center gap-3 px-4 pb-3 pt-7">
          <Avatar src={author.avatarUrl} name={author.displayName} className="h-9 w-9 border border-white/40" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{author.displayName}</p>
            <p className="text-xs font-medium text-white/70">{timeAgo(current.createdAt)}</p>
          </div>
          {/*
            🔴 16 Ağu 2026 — GÖZ ARTIK DÜĞME.
            Sayaç duruyordu ama "kim baktı" sorusunun karşılığı yoktu; sayıya
            dokunmayı deneyen kullanıcı hiçbir şey olmadığını görüyordu.
            ⚠️ Yalnız `mine` hikayede çizilir — sunucu da başkasının listesini
            403 ile reddeder (istemcinin gizlemesi güvenlik sayılmaz).
          */}
          {current.mine && (
            <button
              type="button"
              onClick={() => setSheetOpen((v) => !v)}
              aria-expanded={sheetOpen}
              aria-label={t('story.viewers')}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10"
            >
              <Eye className="h-4 w-4" /> {current.viewCount}
            </button>
          )}
          {current.mine && onDelete && (
            <button
              onClick={() => onDelete(current.id)}
              className="grid h-9 w-9 place-items-center rounded-full text-white/90 hover:bg-white/10"
              aria-label={t('story.delete')}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/10"
            aria-label={t('story.close')}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* görsel + dokunma alanı */}
        <div
          className="relative flex flex-1 items-center justify-center touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => (pausedRef.current = false)}
        >
          <img src={current.mediaUrl} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
        </div>

        {/* açıklama — liste açıkken gizlenir, yoksa listenin altında kalır */}
        {current.caption && !sheetOpen && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 to-transparent p-5 pt-12">
            <p className="text-sm font-medium leading-relaxed text-white">{current.caption}</p>
          </div>
        )}

        {/* --------------------------------------------- kimler gördü sayfası */}
        {sheetOpen && current.mine && (
          <ViewersSheet storyId={current.id} count={current.viewCount} onClose={() => setSheetOpen(false)} />
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * <b>Hikayeyi kimler gördü</b> — göz simgesine dokununca alttan açılan sayfa.
 *
 * <p>⚠️ Sorgu <b>ancak sayfa açılınca</b> atılır (bileşen o anda kurulur).
 * Görüntüleyiciyle birlikte peşin çekmek, hikayeye bakan herkese her karede
 * kimsenin görmeyeceği bir istek attırırdı.
 *
 * <p>⚠️ Kap `absolute inset-0` DEĞİL, alta yapışık ve <b>yüksekliği sınırlı</b>:
 * hikayenin kendisi arkada görünmeye devam etmeli, kullanıcı hangi karenin
 * listesine baktığını görebilmeli.
 */
function ViewersSheet({
  storyId,
  count,
  onClose,
}: {
  storyId: string
  count: number
  onClose: () => void
}) {
  const t = useT()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['story-viewers', storyId],
    queryFn: () => storyViewers(storyId),
    retry: false,
  })

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex max-h-[62%] flex-col rounded-t-2xl bg-black/85 backdrop-blur-xl">
      <button
        type="button"
        onClick={onClose}
        className="flex shrink-0 items-center gap-2 px-4 py-3 text-start text-sm font-semibold text-white"
      >
        <ChevronDown className="h-5 w-5 shrink-0" />
        <span className="flex-1">{t('story.viewers')}</span>
        <span className="tabular-nums text-white/70">{count}</span>
      </button>

      {/* ⚠️ `min-h-0` şart: esnek bir sütunun içindeki kaydırılabilir alan
          `min-height:auto` yüzünden içeriği kadar büyür ve kapağı taşırır. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-white/60" />
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-sm font-medium text-white/70">{t('story.viewersFailed')}</p>
        ) : !data?.length ? (
          <p className="py-6 text-center text-sm font-medium text-white/70">{t('story.viewersEmpty')}</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {data.map((row) => (
              <li key={row.viewer.id} className="flex items-center gap-3 py-2.5">
                <Avatar
                  src={row.viewer.avatarUrl}
                  name={row.viewer.displayName}
                  className="h-9 w-9 shrink-0"
                />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-semibold text-white">
                    {row.viewer.displayName}
                  </span>
                  <span className="block truncate text-xs font-medium text-white/60">
                    @{row.viewer.username}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-white/60">
                  {timeAgo(row.viewedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="pt-3 text-center text-[11px] font-medium text-white/45">
          {t('story.viewersOnlyOwner')}
        </p>
      </div>
    </div>
  )
}
