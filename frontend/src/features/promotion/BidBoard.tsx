import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Crown, Rocket, TrendingUp, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { getBidBoard, formatMoney, type BoardRow } from '@/lib/storeBids'
import { useI18nStore } from '@/stores/i18n'
import { useT } from '@/i18n'
import { BidDialog } from './BidDialog'

/**
 * <b>Öne çıkarma tahtası</b> — haritanın sol üstündeki cam kapsül (98. tur).
 *
 * <p>Kullanıcı isteği: *"haritada şu anki trend kısmını kaldırıp yerine bu
 * geliştirmeyi yapacağız; o trend kısmının tasarımını apple glass'a çevir ve
 * yeni geliştirmeyi onun yerine getir"*.
 *
 * <p>Model {@code bidkick.me}: en çok ödeyen üstte, süre yok. Kapalı hâlde tek
 * satır (lider), açıldığında ilk 10 + son hareketler + tüm zamanlar.
 *
 * <h3>🔴 Neden kapalı başlar ve kapatılabilir</h3>
 * <p>Harita bu ürünün ana yüzeyi; sabit duran bir liste tuvali kapatır.
 * Kapatma tercihi {@code localStorage}'da kalıcıdır — eski trend şeridinden
 * devralınan davranış, çünkü doğruydu.
 *
 * <h3>⚠️ Boşken de çizilir</h3>
 * <p>Eski şerit veri yoksa {@code null} dönüyordu. Burada tam tersi gerekli:
 * liste boşsa <b>ilk sırayı almak</b> en cazip andır ve kullanıcının bunu
 * görmesi lazım. Boş durumda tek satırlık bir davet çizilir.
 */
const STORAGE_KEY = 'waydee-bidboard-open'

export function BidBoard({
  onFlyTo,
  className,
}: {
  /** Haritada bir mağazaya uçmak için (yalnız harita yüzeyinde verilir). */
  onFlyTo?: (lng: number, lat: number) => void
  className?: string
}) {
  const t = useT()
  const navigate = useNavigate()
  const locale = useI18nStore((s) => s.locale)
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'false')
  const [expanded, setExpanded] = useState(false)
  const [bidding, setBidding] = useState(false)

  const { data } = useQuery({
    queryKey: ['bid-board'],
    queryFn: getBidBoard,
    staleTime: 60_000,
    /* ⚠️ Pencere odağında tazelenir: kullanıcı ödeme sayfasından döndüğünde
       sırasının değiştiğini görmeli. Sabit bir aralıkla yoklamak, haritada
       durup duran herkes için gereksiz istek demekti. */
    refetchOnWindowFocus: true,
  })

  const rows = data?.rows ?? []
  const leader = rows[0]
  const me = data?.me

  const openRow = (row: BoardRow) => {
    setExpanded(false)
    if (onFlyTo && row.lng != null && row.lat != null) onFlyTo(row.lng, row.lat)
    else navigate(`/t/${row.territoryId}`)
  }

  /* ⚠️ Tutarlar sunucudan **sayı** gelir (Jackson `BigDecimal` → JSON number);
     imza da öyle olmalı — `string` yazmak 25 Ağu'da üretimde ekran düşürdü. */
  const money = useMemo(
    () => (amount: number, currency: string) => formatMoney(amount, currency, locale),
    [locale],
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          localStorage.setItem(STORAGE_KEY, 'true')
        }}
        className={`waydee-bid-pill pointer-events-auto ${className ?? ''}`}
        aria-label={t('bid.title')}
      >
        <Crown className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <>
      <div className={`waydee-bid-capsule pointer-events-auto ${className ?? ''}`}>
        <button
          type="button"
          className="waydee-bid-capsule-main"
          onClick={() => setExpanded(true)}
          title={t('bid.openBoard')}
        >
          <span className="waydee-bid-crown">
            <Crown className="h-3.5 w-3.5" />
          </span>
          {leader ? (
            <>
              <span className="waydee-bid-name">{leader.storeName}</span>
              <span className="waydee-bid-amount">{money(leader.amount, leader.currency)}</span>
            </>
          ) : (
            /* 🔴 Boşken davet: ilk sırayı almak en cazip an. */
            <span className="waydee-bid-name">{t('bid.emptyLead')}</span>
          )}
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60 rtl:-scale-x-100" />
        </button>
        <button
          type="button"
          className="waydee-bid-boost"
          onClick={() => setBidding(true)}
          title={t('bid.promote')}
        >
          <Rocket className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('bid.promoteShort')}</span>
        </button>
        <button
          type="button"
          className="waydee-bid-close"
          onClick={() => {
            setOpen(false)
            localStorage.setItem(STORAGE_KEY, 'false')
          }}
          aria-label={t('common.close')}
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/*
        ---- tam tahta ----

        🔴 25 Ağu 2026 — PORTAL ŞART (bildirilen hata: *"sol üstteki yere
        tıklayınca popup kapanmıyor"*).

        Tahta haritanın üstündeki şerit kabının içinde çiziliyordu ve o kap
        `z-20` ile **kendi yığın bağlamını** kuruyor. Perdenin `z-60`'ı o
        bağlamın İÇİNDE geçerli: dışarıdan bakıldığında hâlâ 20. Sol gezinme
        kolonu (`z-50`) ve üst çubuk (`z-40`) perdenin ÜSTÜNE düşüyordu, yani
        ekranın sol üst köşesine yapılan tıklama perdeye hiç ulaşmıyor,
        kolona gidiyordu.

        ⚠️ İkinci bir sebep daha vardı ve ikisi birden düzeltildi: kabın
        `pointer-events: none` mirası perdeyi tıklanamaz yapıyordu
        (`.waydee-bid-scrim`de `pointer-events: auto`).

        ⚠️ Portal `document.body`ye açılır — böylece perde uygulamanın en
        dışında durur ve `z-60` gerçekten en üstteki katman olur.
      */}
      {expanded && createPortal(
        <div
          className="waydee-bid-scrim"
          role="dialog"
          aria-modal="true"
          onClick={() => setExpanded(false)}
        >
          <div className="waydee-bid-sheet" onClick={(e) => e.stopPropagation()}>
            <header className="waydee-bid-sheet-head">
              <div className="min-w-0">
                <p className="text-[15px] font-black tracking-tight">{t('bid.title')}</p>
                <p className="text-[12px] font-medium text-muted">{t('bid.subtitle')}</p>
              </div>
              <button
                type="button"
                className="waydee-bid-close"
                onClick={() => setExpanded(false)}
                aria-label={t('common.close')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </header>

            {/* tüm zamanlar */}
            {data && (
              <div className="waydee-bid-stats">
                <span>
                  <b>{money(data.allTimeHighest, data.currency)}</b>
                  {t('bid.allTimeHighest')}
                </span>
                <span>
                  <b>{money(data.allTimeTotal, data.currency)}</b>
                  {t('bid.allTimeTotal')}
                </span>
                <span>
                  <b>{data.activeCount}</b>
                  {t('bid.activeCount')}
                </span>
              </div>
            )}

            <div className="waydee-bid-list">
              {rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] font-medium text-muted">
                  {t('bid.emptyBoard')}
                </p>
              ) : (
                rows.map((row) => (
                  <button
                    key={row.bidId}
                    type="button"
                    className={`waydee-bid-row ${row.mine ? 'waydee-bid-row-mine' : ''}`}
                    onClick={() => openRow(row)}
                  >
                    <span className="waydee-bid-rank">{row.rank}</span>
                    <Avatar
                      src={row.avatarUrl ?? undefined}
                      name={row.ownerDisplayName ?? row.ownerUsername}
                      className="h-8 w-8 shrink-0"
                    />
                    <span className="min-w-0 flex-1 text-start">
                      <span className="block truncate text-[13.5px] font-bold">{row.storeName}</span>
                      <span className="block truncate text-[11.5px] font-medium text-muted">
                        @{row.ownerUsername}
                      </span>
                    </span>
                    {row.mine && <span className="waydee-bid-you">{t('bid.you')}</span>}
                    <span className="shrink-0 text-[13px] font-black tabular-nums">
                      {money(row.amount, row.currency)}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* son hareketler */}
            {!!data?.latestMoves.length && (
              <div className="waydee-bid-moves">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-faint">
                  <TrendingUp className="h-3 w-3" /> {t('bid.latestMoves')}
                </p>
                {data.latestMoves.map((m, i) => (
                  <p key={`${m.storeName}-${i}`} className="truncate text-[12px] font-medium text-muted">
                    <b className="text-ink">{m.storeName}</b> · {money(m.amount, m.currency)}
                  </p>
                ))}
              </div>
            )}

            <footer className="waydee-bid-sheet-foot">
              {me?.rank ? (
                <p className="text-[12.5px] font-semibold text-muted">
                  {t('bid.yourRank', { rank: String(me.rank) })}
                </p>
              ) : (
                <p className="text-[12.5px] font-semibold text-muted">{t('bid.notListed')}</p>
              )}
              <button
                type="button"
                className="waydee-pill waydee-pill-primary"
                onClick={() => {
                  setExpanded(false)
                  setBidding(true)
                }}
              >
                <Rocket className="h-4 w-4" /> {t('bid.promote')}
              </button>
            </footer>
          </div>
        </div>,
        document.body,
      )}

      {bidding && <BidDialog onClose={() => setBidding(false)} />}
    </>
  )
}
