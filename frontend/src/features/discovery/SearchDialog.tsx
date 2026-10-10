import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { profilePath } from '@/lib/profilePath'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CornerDownLeft, Loader2, MapPin, Search, User as UserIcon, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { lockScroll } from '@/lib/scrollLock'
import { cn } from '@/lib/utils'
import { search, type SearchHit } from '@/lib/discovery'

interface SearchDialogProps {
  onClose: () => void
  /** Haritada bir daireye uçmak için (harita yüzeyinde verilir). */
  onFlyTo?: (lng: number, lat: number) => void
}

const RECENT_KEY = 'waydee-recent-searches'
const MAX_RECENT = 6

/**
 * Kişi ve daire araması.
 *
 * Klavye tamamen destekli (↑/↓ gez, ↵ aç, Esc kapat) — arama bir "komut
 * paleti" gibi kullanılabilmeli. Sorgu 250 ms geciktirilir; her tuşta istek
 * atmak sunucuyu boşuna yorardı.
 *
 * ⚠️ Animasyon yalnız `opacity` (vault transform tuzağı); panel konumu kritik.
 */

/**
 * <b>Eski "son arama" kayıtlarını onarır.</b>
 *
 * <h3>🔴 17 Ağu 2026 — ölçülerek yakalandı</h3>
 * Profil adresleri {@code /u/{uuid}} yerine {@code /{username}}'e çevrildi ve
 * dağıtım <b>doğrulandı</b> (canlı pakette bu turun dizeleri arandı, bulundu).
 * Buna rağmen kullanıcı hâlâ {@code waydee.com/u/0d66e4fa-…} adresine
 * düşüyordu.
 *
 * <b>Sebep:</b> tıkladığı öğe aramadan değil, <b>{@code localStorage}'daki son
 * aramalar listesinden</b> geliyordu. O kayıtlar sunucunun ESKİ yanıtıyla
 * yazılmıştı ve içlerinde {@code username} alanı yok — {@code profilePath} de
 * haklı olarak köprüye düşüyordu.
 *
 * <p>⚠️ <b>Ders:</b> bir API alanı eklendiğinde, o yanıtın <b>diske yazılmış
 * eski kopyaları</b> kendiliğinden güncellenmez. Sunucuyu ve istemciyi aynı
 * anda dağıtmak yetmez; kalıcı önbelleğin de bir <b>göç yolu</b> olmalı.
 *
 * <p>Kayıtlar <b>atılmaz, ONARILIR</b>: kullanıcı adı zaten elimizde — altyazı
 * {@code "@yasin_karaca"} biçiminde saklanıyor. Atmak, kullanıcının geçmişini
 * sebepsiz silmek olurdu.
 *
 * @param raw depodan okunan ham dizi (biçimi garanti değil)
 */
function migrateRecent(raw: unknown): SearchHit[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const hit = item as SearchHit
    if (!hit.id || !hit.type) return []
    if (hit.type !== 'USER' || hit.username) return [hit]
    // Altyazı "@kullaniciadi" — tek gerçek kaynak bu.
    const fromSubtitle = typeof hit.subtitle === 'string' && hit.subtitle.startsWith('@')
      ? hit.subtitle.slice(1).trim()
      : ''
    return [fromSubtitle ? { ...hit, username: fromSubtitle } : hit]
  })
}

export function SearchDialog({ onClose, onFlyTo }: SearchDialogProps) {
  /* 🔴 17 Ağu 2026 — bu ekranın metinleri sabit TÜRKÇEYDİ ("Son aramalar",
     "Kişiler", "gez"…). Beş dilli bir arayüzde arama kutusu tek dilde
     kalıyordu. Sözlüğe `search.*` bölümü eklendi (vault kuralı: her
     geliştirme çok dilli). */
  const t = useT()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [cursor, setCursor] = useState(0)
  const [recent, setRecent] = useState<SearchHit[]>(() => {
    try {
      return migrateRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'))
    } catch {
      return []
    }
  })

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(t)
  }, [term])

  useEffect(() => {
    const release = lockScroll()
    inputRef.current?.focus()
    return release
  }, [])

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => search(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  })

  /** Tek düz liste — klavye gezinmesi bölümleri aşarak çalışsın. */
  const flat = useMemo<SearchHit[]>(() => {
    if (debounced.length < 2) return recent
    return [...(data?.territories ?? []), ...(data?.users ?? [])]
  }, [data, debounced, recent])

  useEffect(() => setCursor(0), [debounced, flat.length])

  /*
   * 🔴 17 Ağu 2026 — ARAMA GEÇMİŞİNİ SİLME (kullanıcı isteği).
   *
   * Son aramalar `localStorage`'ta birikiyordu ve <b>temizlemenin hiçbir yolu
   * yoktu</b>: yanlışlıkla açılan bir profil ya da artık görmek istenmeyen bir
   * kişi listede kalıcı olarak duruyordu. Ortak bir bilgisayarda bu bir
   * gizlilik sorunudur.
   *
   * ⚠️ Yazma tek yerden ({@link persistRecent}) — üç ayrı çağrı da state ile
   * depoyu birlikte güncellemek zorunda; biri unutulsa liste ekranda gider
   * ama sayfa yenilenince geri gelirdi.
   */
  const persistRecent = (next: SearchHit[]) => {
    setRecent(next)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* kota dolu / gizli mod — geçmiş bir kolaylıktır, akışı kesmez */
    }
  }

  /** Tek kaydı geçmişten çıkarır. */
  const removeRecent = (hit: SearchHit) =>
    persistRecent(recent.filter((r) => !(r.type === hit.type && r.id === hit.id)))

  /** Tüm geçmişi siler. */
  const clearRecent = () => persistRecent([])

  const open = (hit: SearchHit) => {
    // Son aramalar: aynı kayıt tekrarlanmaz, en yeni başa gelir.
    persistRecent(
      [hit, ...recent.filter((r) => !(r.type === hit.type && r.id === hit.id))].slice(0, MAX_RECENT),
    )

    onClose()
    if (hit.type === 'TERRITORY') {
      if (onFlyTo && hit.lng != null && hit.lat != null) onFlyTo(hit.lng, hit.lat)
      else navigate(`/t/${hit.id}`)
    } else {
      // 🔴 Köprü YOK: arama sonucu artık profil adını da taşıyor.
      navigate(profilePath(hit))
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter' && flat[cursor]) {
      e.preventDefault()
      open(flat[cursor])
    }
  }

  const showRecent = debounced.length < 2 && recent.length > 0
  const empty = debounced.length >= 2 && !isFetching && flat.length === 0

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-scrim p-4 pt-[10vh] backdrop-blur-[3px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('search.title')}
        className="flex max-h-[min(34rem,76vh)] w-full max-w-xl flex-col overflow-hidden rounded-card bg-surface shadow-float"
        onKeyDown={onKeyDown}
      >
        {/* arama girdisi */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <Search className="h-4.5 w-4.5 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('search.placeholder')}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-faint"
            aria-label="Arama"
          />
          {isFetching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-faint" />}
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-subtle hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* sonuçlar */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {debounced.length < 2 && !showRecent && (
            <p className="px-3 py-10 text-center text-[13px] text-faint">
              {t('search.minChars')}
            </p>
          )}

          {showRecent && (
            <Section
              label={t('search.recent')}
              action={
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-[11px] font-semibold text-muted transition-colors hover:text-ink"
                >
                  {t('search.clearAll')}
                </button>
              }
            >
              {recent.map((hit, i) => (
                <HitRow
                  key={`${hit.type}-${hit.id}`}
                  hit={hit}
                  active={i === cursor}
                  onSelect={() => open(hit)}
                  onHover={() => setCursor(i)}
                  onRemove={() => removeRecent(hit)}
                  removeLabel={t('search.removeOne')}
                />
              ))}
            </Section>
          )}

          {empty && (
            <p className="px-3 py-10 text-center text-[13px] text-faint">
              {t('search.noResults', { q: debounced })}
            </p>
          )}

          {debounced.length >= 2 && !!data?.territories.length && (
            <Section label={t('search.territories')}>
              {data.territories.map((hit, i) => (
                <HitRow
                  key={`t-${hit.id}`}
                  hit={hit}
                  active={i === cursor}
                  onSelect={() => open(hit)}
                  onHover={() => setCursor(i)}
                />
              ))}
            </Section>
          )}

          {debounced.length >= 2 && !!data?.users.length && (
            <Section label={t('search.people')}>
              {data.users.map((hit, i) => {
                const idx = (data.territories?.length ?? 0) + i
                return (
                  <HitRow
                    key={`u-${hit.id}`}
                    hit={hit}
                    active={idx === cursor}
                    onSelect={() => open(hit)}
                    onHover={() => setCursor(idx)}
                  />
                )
              })}
            </Section>
          )}
        </div>

        {/* klavye ipucu */}
        <div className="hidden shrink-0 items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] font-medium text-faint md:flex">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> {t('search.navigate')}
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>
              <CornerDownLeft className="h-3 w-3" />
            </Kbd>{' '}
            {t('search.open')}
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>esc</Kbd> {t('search.close')}
          </span>
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}

function Section({
  label,
  action,
  children,
}: {
  label: string
  /** Başlığın SAĞINDA duran eylem (ör. "Tümünü temizle"). */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mb-1">
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</h3>
        {action}
      </div>
      <ul>{children}</ul>
    </section>
  )
}

function HitRow({
  hit,
  active,
  onSelect,
  onHover,
  onRemove,
  removeLabel,
}: {
  hit: SearchHit
  active: boolean
  onSelect: () => void
  onHover: () => void
  /** Verilirse satırın sonunda "geçmişten kaldır" düğmesi çizilir. */
  onRemove?: () => void
  removeLabel?: string
}) {
  return (
    /*
     * ⚠️ Arka plan ve hover artık <li>'de, <button>'da DEĞİL. Silme düğmesi
     * satırın kardeşi olmak zorunda: <button> içine <button> koymak geçersiz
     * HTML'dir ve tarayıcılar iç düğmenin tıklamasını öngörülemez biçimde ele
     * alır. Vurgu tüm satırı kaplasın diye kap boyandı.
     */
    <li
      className={cn(
        'flex items-center gap-1 rounded-2xl pe-1 transition-colors',
        active ? 'bg-subtle' : 'hover:bg-subtle/70',
      )}
      onMouseEnter={onHover}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
      >
        {hit.type === 'TERRITORY' ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-soft text-[#0f78bd]">
            <MapPin className="h-4 w-4" />
          </span>
        ) : (
          <Avatar src={hit.avatarUrl} name={hit.title} className="h-9 w-9 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold leading-tight">{hit.title}</span>
          <span className="block truncate text-[12px] font-medium text-faint">{hit.subtitle}</span>
        </span>
        {hit.note && (
          <span className="shrink-0 rounded-md bg-subtle px-1.5 py-0.5 text-[10.5px] font-semibold text-muted">
            {hit.note}
          </span>
        )}
        {hit.type === 'USER' && <UserIcon className="h-3.5 w-3.5 shrink-0 text-faint" />}
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          title={removeLabel}
          /* ⚠️ Satırın kendi tıklamasına düşmesin. */
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-line hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-subtle px-1 font-sans text-[10px] font-semibold text-muted">
      {children}
    </kbd>
  )
}
