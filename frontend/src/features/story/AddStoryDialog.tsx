import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, MapPin, Search, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { storyTargets } from '@/lib/social'
import { cn } from '@/lib/utils'

interface AddStoryDialogProps {
  previewUrl: string
  submitting: boolean
  onClose: () => void
  /** Seçilen her bölgede ayrı bir hikaye yayınlanır; boş dizi = yalnız profilim. */
  onShare: (caption: string, territoryIds: string[]) => void
}

/**
 * Hikaye paylaşma: önizleme + açıklama + **çoklu bölge seçimi**.
 *
 * Bölge listesi yalnız **profil türü akış (STANDARD)** olan aktif bölgeleri içerir —
 * gömülü site/HTML profilinde akış gösterilmediği için oraya atılan hikaye hiçbir
 * yerde görünmezdi. Çok bölgesi olan kullanıcılar için arama ve "tümünü seç" var;
 * tek bölgesi olanlar tek dokunuşla açıp kapatır.
 */
export function AddStoryDialog({ previewUrl, submitting, onClose, onShare }: AddStoryDialogProps) {
  const [caption, setCaption] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const { data: targets, isLoading } = useQuery({ queryKey: ['story-targets'], queryFn: storyTargets })
  const list = useMemo(() => targets ?? [], [targets])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    if (!q) return list
    return list.filter((t) => t.name.toLocaleLowerCase('tr').includes(q))
  }, [list, search])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allSelected = list.length > 0 && selected.size === list.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(list.map((t) => t.territoryId)))

  return (
    <Dialog open onClose={onClose} title="Hikaye paylaş" className="max-w-md">
      <div className="space-y-3.5">
        <div className="overflow-hidden rounded-2xl bg-black">
          <img src={previewUrl} alt="" className="mx-auto max-h-[38vh] w-auto object-contain" />
        </div>

        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Bir şeyler yaz (opsiyonel)…"
          maxLength={200}
          className="min-h-14"
        />

        {/* Nerede yayınlansın */}
        <div className="rounded-2xl border border-line">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
              Nerede yayınlansın
            </p>
            {list.length > 1 && (
              <button
                type="button"
                onClick={toggleAll}
                className="shrink-0 text-[11px] font-semibold text-accent hover:underline"
              >
                {allSelected ? 'Seçimi temizle' : 'Tümünü seç'}
              </button>
            )}
          </div>

          {/* Profil satırı — her zaman yayınlanır, bilgi amaçlı */}
          <div className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-subtle text-muted">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">Profilim</p>
              <p className="text-[11px] font-medium text-faint">Hikaye her durumda profilinde görünür</p>
            </div>
            <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-[10px] font-bold text-muted">
              VARSAYILAN
            </span>
          </div>

          {isLoading && (
            <div className="px-3 py-4">
              <Spinner />
            </div>
          )}

          {!isLoading && list.length === 0 && (
            <p className="px-3 py-3 text-[11px] font-medium leading-snug text-faint">
              Hikaye paylaşılabilecek bölgen yok. Yalnız profil türü <b>akış</b> olan aktif
              bölgeler burada listelenir.
            </p>
          )}

          {list.length > 4 && (
            <div className="border-b border-line px-2.5 py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Bölge ara"
                  className="h-8 pl-8 text-[12px]"
                />
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="max-h-44 overflow-y-auto">
              {filtered.map((t) => {
                const on = selected.has(t.territoryId)
                return (
                  <button
                    key={t.territoryId}
                    type="button"
                    onClick={() => toggle(t.territoryId)}
                    aria-pressed={on}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-subtle"
                  >
                    <span
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors',
                        on ? 'bg-accent text-white' : 'bg-subtle text-muted',
                      )}
                    >
                      {on ? <Check className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{t.name}</span>
                      {t.regionLabel && (
                        <span className="block truncate text-[11px] font-medium text-faint">{t.regionLabel}</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'h-4 w-4 shrink-0 rounded-md border-2 transition-colors',
                        on ? 'border-accent bg-accent' : 'border-line',
                      )}
                    />
                  </button>
                )
              })}
            </div>
          )}

          {!isLoading && list.length > 0 && filtered.length === 0 && (
            <p className="px-3 py-3 text-[11px] font-medium text-faint">Eşleşen bölge yok.</p>
          )}
        </div>

        <Button className="w-full" disabled={submitting} onClick={() => onShare(caption, [...selected])}>
          {submitting ? (
            <Spinner className="border-on-ink/30 border-t-on-ink" />
          ) : selected.size > 0 ? (
            `Paylaş — profilim + ${selected.size} bölge`
          ) : (
            'Paylaş'
          )}
        </Button>
      </div>
    </Dialog>
  )
}
