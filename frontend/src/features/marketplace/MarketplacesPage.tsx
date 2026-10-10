import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check, LayoutGrid, MapPin, Store, Users } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { LISTING_STATUS_META, listMarketplaces, type MarketplaceResponse } from '@/lib/marketplace'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { useI18nStore } from '@/stores/i18n'

type TabKey = 'all' | 'open' | 'mine'

/**
 * <b>Pazar yerleri</b> (`/market`) — üyenin göreceği liste.
 *
 * <p>🔴 <b>16 Ağu 2026 — ekran ANA SAYFANIN diline taşındı.</b> Önceki sürüm
 * genel amaçlı `rounded-card bg-surface shadow-card` kutulardan kuruluydu:
 * sol hizalı bir başlık, iki kolon kart ve her kartın altında ayrı bir
 * "Pazarı gör" düğmesi. Uygulamanın geri kalanı (ana sayfa, profil, vitrin)
 * <b>ortalı başlık + `waydee-ptabs` sekme şeridi + karo ızgara + `waydee-empty`
 * boş durumu</b> konuşurken burası tek başına başka bir dil konuşuyordu.
 * Artık aynı dili konuşuyor; pazar yerine özgü tek fark kapak üstündeki
 * <b>cam rozet</b> ve kapağa taşan <b>logo karosu</b>.
 *
 * <p>🔴 Kartın altındaki ayrı düğme <b>kaldırıldı</b>: kartın kendisi zaten
 * tek bir düğmeydi, yani aynı hedefe iki ayrı tıklama alanı vardı ve karo
 * ızgarayı ikiye bölüyordu.
 *
 * <p>⚠️ Metinlerin <b>hiçbiri</b> artık bileşende sabit değil — sözlükteki
 * `market.*` bölümünden gelir ve beş dile çevrilmiştir. Eski sürümde başlık,
 * alt başlık, rozetler ve boş durum baştan sona Türkçeydi.
 */
export function MarketplacesPage() {
  const t = useT()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) || 'all'

  const { data, isLoading } = useQuery({
    queryKey: ['marketplaces'],
    queryFn: listMarketplaces,
    staleTime: 60_000,
  })

  const setTab = (next: TabKey) => {
    const p = new URLSearchParams(params)
    if (next === 'all') p.delete('tab')
    else p.set('tab', next)
    setParams(p, { replace: true })
  }

  /* Filtre istemcide: liste bir üyenin görebileceği pazarlarla sınırlı ve
     sunucu zaten hepsini tek istekte veriyor — sayfalanmış bir uç yok. */
  const shown = useMemo(() => {
    const all = data ?? []
    if (tab === 'open') return all.filter((m) => m.acceptingApplications)
    if (tab === 'mine') return all.filter((m) => !!m.myListingStatus)
    return all
  }, [data, tab])

  const TABS: { key: TabKey; icon: typeof Store; label: string }[] = [
    { key: 'all', icon: LayoutGrid, label: t('market.tabAll') },
    { key: 'open', icon: Store, label: t('market.tabOpen') },
    { key: 'mine', icon: Check, label: t('market.tabMine') },
  ]

  return (
    <div className="flex w-full flex-col items-center">
      <header className="waydee-market-head">
        <h1 className="waydee-market-title">{t('market.title')}</h1>
        <p className="waydee-market-sub">{t('market.subtitle')}</p>
      </header>

      {/* Sekme şeridi ana sayfayla AYNI bileşen (`waydee-ptabs`) — üçüncü bir
          sekme uygulaması icat etmiyoruz. */}
      <div className="mt-3 flex items-center gap-2">
        <div className="waydee-ptabs" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className="waydee-ptab"
            >
              {tab === item.key && <span className="waydee-ptab-cursor" aria-hidden />}
              <span className="waydee-ptab-content">
                <item.icon className="h-3.5 w-3.5" />
                <span className="uppercase">{item.label}</span>
              </span>
            </button>
          ))}
        </div>
        {!isLoading && !!data?.length && (
          <span className="waydee-market-count">{t('market.countAll', { n: data.length })}</span>
        )}
      </div>

      <div className="mt-4 w-full max-w-screen-xl">
        {isLoading ? (
          <PageSpinner />
        ) : !shown.length ? (
          <div className="waydee-empty">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-subtle text-muted">
              <Store className="h-5 w-5" />
            </span>
            <h3 className="mb-2 text-lg font-semibold">
              {data?.length ? t('market.emptyFiltered') : t('market.empty')}
            </h3>
            <p className="mb-4 text-[13px] text-muted">
              {data?.length ? t('market.emptyFilteredDesc') : t('market.emptyDesc')}
            </p>
            {!!data?.length && (
              <button type="button" onClick={() => setTab('all')} className="waydee-empty-cta">
                {t('market.showAll')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((m, i) => (
              <MarketplaceCard
                key={m.id}
                marketplace={m}
                index={i}
                onOpen={() => navigate(`/market/${m.slug}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MarketplaceCard({
  marketplace: m,
  index,
  onOpen,
}: {
  marketplace: MarketplaceResponse
  index: number
  onOpen: () => void
}) {
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const mine = m.myListingStatus ? LISTING_STATUS_META[m.myListingStatus] : null
  const state = m.acceptingApplications ? 'open' : m.full ? 'full' : 'closed'

  return (
    <motion.article
      // Yalnız opacity — ızgarada konum animasyonu framer/React 19'da takılabiliyor.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.35) }}
      className="waydee-market-card"
    >
      {/*
        🔴 KAPAK BANDI KALDIRILDI (ikinci geçiş). Kartın tepesinde 16:9 bir
        görsel alanı vardı ve kapak yoksa oraya pazarın vurgu renginden bir
        degrade basılıyordu — kartın en büyük parçası hiçbir bilgi taşımayan
        bir renkti. Kalan her şey bilgi: işaret, ad, tanıtım, sayılar, durum.
      */}
      <button type="button" onClick={onOpen} className="waydee-market-body">
        <span className="waydee-market-top">
          {/* ⚠️ Pazar yerinin LOGOSU YOK (`MarketplaceResponse`da böyle bir alan
              yok — logo stant sahibine aittir), bu yüzden baş harf. Renk tek:
              on kartlık bir ızgarada on ayrı vurgu rengi sakinliği bozuyordu. */}
          <span className="waydee-market-mark">{m.name.charAt(0).toUpperCase()}</span>
          <span className="waydee-market-text">
            <span className="waydee-market-name">{m.name}</span>
            <span className="waydee-market-tagline">{m.tagline ?? ''}</span>
          </span>
        </span>

        <span className="waydee-market-meta">
          {/* Durum artık cam bir hapın içinde değil, satırın başında tek nokta. */}
          <span className="waydee-market-state" data-tone={state}>
            <span className="waydee-market-dot" aria-hidden />
            {state === 'open'
              ? t('market.open')
              : state === 'full'
                ? t('market.full')
                : t('market.closed')}
          </span>
          <span>
            <Users className="h-3 w-3" />
            {m.maxListings
              ? t('market.stallsOf', { n: m.listingCount, max: m.maxListings })
              : t('market.stalls', { n: m.listingCount })}
          </span>
          <span>
            <MapPin className="h-3 w-3" />
            {t('market.area', {
              n: m.areaKm2.toLocaleString(locale, { maximumFractionDigits: 0 }),
            })}
          </span>
          {mine && (
            <span
              className={cn(
                'waydee-market-mine',
                mine.tone === 'success' && 'bg-mint-soft text-[#4f9e33]',
                mine.tone === 'warning' && 'bg-sand-soft text-[#b57200]',
                mine.tone === 'danger' && 'bg-peach-soft text-[#e2402a]',
                mine.tone === 'neutral' && 'bg-subtle text-muted',
                mine.tone === 'info' && 'bg-sky-soft text-[#0f78bd]',
              )}
            >
              {t(mine.labelKey)}
            </span>
          )}
        </span>
      </button>
    </motion.article>
  )
}
