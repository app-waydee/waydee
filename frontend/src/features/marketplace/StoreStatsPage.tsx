import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DoorOpen, Eye, Heart, Package, Timer, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageSpinner } from '@/components/ui/spinner'
import { getStoreStats, splitDuration, type StoreStats } from '@/lib/storeStats'
import { useSeo } from '@/lib/seo'
import { useT } from '@/i18n'

/**
 * <b>Mağaza istatistikleri</b> (`/market/:slug/my-store/:listingId/stats`).
 *
 * <p>Kullanıcı isteği (97. tur): <i>"kaç kişinin kapıdan geçip kaç kişinin
 * mağazada ne kadar kaldığını ... stüdyo butonunun sağında istatistikler
 * butonu ... stant sahibi görebilsin"</i>.
 *
 * <h3>🔴 Her sayının yanında paydası var</h3>
 * <p>Vault'un 91. tur dersi (*"gösterilen ama artmayan sayaç"*) bu ekranın
 * kuruluş sebebidir: burada okunan her sayı {@code store_visits} tablosundaki
 * gerçek satırlardan geliyor ve <b>"kapıdan geçiş"</b> ile <b>"tekil
 * ziyaretçi"</b> ayrı ayrı yazılıyor — ikisini tek bir "ziyaret" sayısına
 * indirmek, sahibinin kaç <i>kişiye</i> ulaştığını hiç bilememesi demekti.
 *
 * <p>⚠️ Sayfa yalnız <b>sahibine</b> açılır; kapı sunucuda
 * ({@code StoreStatsService.stats}). İstemcideki gizleme güvenlik sayılmaz.
 */
export function StoreStatsPage() {
  const t = useT()
  const { slug = '', listingId = '' } = useParams()

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-4 md:px-0">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{t('storeStats.title')}</h1>
          <p className="text-[13px] font-medium text-muted">{t('storeStats.sub')}</p>
        </div>
        <Link to={`/market/${slug}/my-store/${listingId}`}>
          <Button variant="stroke">{t('storeStats.back')}</Button>
        </Link>
      </header>
      <StoreStatsPanel listingId={listingId} />
    </div>
  )
}

/**
 * <b>İstatistik paneli</b> — aynı içerik iki yerde (97. tur, 3. bölüm).
 *
 * <p>🔴 Kullanıcı isteği: istatistikler artık <b>pazar yeri sayfasının
 * altında</b> duruyor (`/market/:slug`), stant listesinin yerinde. Ayrı sayfa
 * ({@link StoreStatsPage}) derin bağlantı olarak yaşamaya devam ediyor.
 *
 * <p>⚠️ İçerik <b>kopyalanmadı</b>, bileşene çıkarıldı: iki ekranın aynı
 * sayıyı farklı biçimlerde göstermesi, vault'un tekrar tekrar öğrendiği hata
 * (95. turdaki `gradientPartner`).
 *
 * <p>⚠️ Panel yalnız <b>sahibine</b> anlamlıdır; sunucu 403 döner ve burada
 * ekran "bu mağaza sana ait değil" yazar. Çağıran taraf zaten yalnız onaylı
 * kendi stantı varken çiziyor.
 */
export function StoreStatsPanel({ listingId }: { listingId: string }) {
  const t = useT()
  /* Aralık: kısa pencere yeni mağazada boş görünür, uzun pencere ölü veriyi
     canlı gösterir — seçim kullanıcıda. */
  const [days, setDays] = useState(30)

  const statsQuery = useQuery({
    queryKey: ['store-stats', listingId, days],
    queryFn: () => getStoreStats(listingId, days),
    enabled: !!listingId,
    retry: false,
  })

  const stats = statsQuery.data
  useSeo(stats ? { title: `${stats.title} · ${t('storeStats.title')}`, noindex: true } : null)

  if (statsQuery.isLoading) return <PageSpinner />

  if (statsQuery.isError || !stats) {
    return (
      <Card className="p-8 text-center">
        <p className="text-[14px] font-semibold">{t('storeStats.notOwner')}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------- aralık ---- */}
      <div className="flex flex-wrap gap-2">
        {[7, 30, 90].map((n) => (
          <button
            key={n}
            type="button"
            className={`waydee-pill ${days === n ? 'waydee-pill-primary' : ''}`}
            onClick={() => setDays(n)}
          >
            {t(n === 7 ? 'storeStats.range7' : n === 30 ? 'storeStats.range30' : 'storeStats.range90')}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------- asıl iki sayı ---- */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric
          icon={<DoorOpen className="h-4 w-4" />}
          value={String(stats.visits)}
          label={t('storeStats.visits')}
          help={t('storeStats.visitsHelp')}
        />
        <Metric
          icon={<Users className="h-4 w-4" />}
          value={String(stats.uniqueVisitors)}
          label={t('storeStats.unique')}
          help={t('storeStats.uniqueHelp')}
        />
        <Metric
          icon={<Timer className="h-4 w-4" />}
          value={<Duration seconds={stats.avgDwellSeconds} />}
          label={t('storeStats.avg')}
          /* 🔴 Payda AÇIKÇA yazılır: "ortalama 2 dk" cümlesi, kaç ziyaretten
             hesaplandığı bilinmeden hiçbir karar verdirmez. */
          help={t('storeStats.avgHelp', { n: String(stats.measuredVisits) })}
        />
        <Metric
          icon={<Timer className="h-4 w-4" />}
          value={<Duration seconds={stats.totalDwellSeconds} />}
          label={t('storeStats.total')}
          help={t('storeStats.totalHelp')}
        />
      </div>

      {/* --------------------------------------------------- yan sayaçlar --- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          icon={<Heart className="h-4 w-4" />}
          value={String(stats.likeCount)}
          label={t('storeStats.likes')}
          help={t('storeStats.likesHelp')}
        />
        <Metric icon={<Eye className="h-4 w-4" />} value={String(stats.viewCount)} label={t('storeStats.views')} />
        <Metric icon={<Package className="h-4 w-4" />} value={String(stats.shelfSize)} label={t('storeStats.shelf')} />
      </div>

      {/* -------------------------------------------------- günlük grafik --- */}
      <Card className="p-4 md:p-5">
        <p className="text-[13px] font-bold">{t('storeStats.daily')}</p>
        {stats.daily.length === 0 ? (
          <div className="mt-6 pb-4 text-center">
            <p className="text-[14px] font-semibold text-ink">{t('storeStats.empty')}</p>
            <p className="mt-1 text-[12.5px] font-medium text-muted">{t('storeStats.emptyHelp')}</p>
          </div>
        ) : (
          <DailyChart stats={stats} />
        )}
      </Card>
    </div>
  )
}

/** Tek sayaç kutusu — ikon · sayı · etiket · (varsa) paydayı açıklayan satır. */
function Metric({
  icon,
  value,
  label,
  help,
}: {
  icon: React.ReactNode
  value: React.ReactNode
  label: string
  help?: string
}) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-[26px] font-black leading-none tabular-nums">{value}</p>
      {help && <p className="mt-2 text-[12px] font-medium leading-snug text-faint">{help}</p>}
    </Card>
  )
}

/**
 * Süreyi okunur hâle getirir.
 *
 * <p>⚠️ Birim kısaltmaları <b>çeviriden</b> gelir: sabit "dk/sn" yazmak,
 * İngilizce açan kullanıcıya Türkçe kısaltma gösterirdi (vault: sunucudan ya
 * da sabitlerden gelen etiketler çok dilli arayüzde basılmaz).
 */
function Duration({ seconds }: { seconds: number }) {
  const t = useT()
  const { h, m, s } = splitDuration(seconds)
  if (h > 0) return <>{h}{t('storeStats.h')} {m}{t('storeStats.m')}</>
  if (m > 0) return <>{m}{t('storeStats.m')} {s}{t('storeStats.s')}</>
  return <>{s}{t('storeStats.s')}</>
}

/**
 * Günlük geçiş çubukları.
 *
 * <p>🔴 89. turun dersi burada uygulanıyor: boş kontrolü <b>dizi uzunluğu</b>
 * değil, <b>en büyük değerin sıfır olup olmadığıdır</b>. Sunucu sıfırlarla
 * dolu bir dizi döndürebilir ve o zaman bütün çubuklar sıfır yükseklikte
 * çizilip grafik "bozuk" görünürdü.
 *
 * <p>⚠️ Tarihler {@code Intl} ile biçimlenir — ay adları sözlükte tutulmaz.
 */
function DailyChart({ stats }: { stats: StoreStats }) {
  const t = useT()
  const max = Math.max(...stats.daily.map((d) => d.visits), 0)
  if (max === 0) {
    return <p className="mt-6 pb-4 text-center text-[13px] font-medium text-muted">{t('storeStats.empty')}</p>
  }

  return (
    <div className="mt-4 flex items-end gap-1 overflow-x-auto pb-1">
      {stats.daily.map((d) => {
        const label = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
          new Date(`${d.day}T00:00:00Z`),
        )
        return (
          <div key={d.day} className="flex min-w-[1.75rem] flex-1 flex-col items-center gap-1">
            <span
              className="w-full rounded-t-md bg-[var(--color-brand,#83bf6e)]"
              /* Taban 4 px: sıfır olmayan bir gün hiç görünmeyen bir çubukla
                 temsil edilseydi "o gün ziyaret yok" diye okunurdu. */
              style={{ height: `${4 + (d.visits / max) * 110}px` }}
              title={t('storeStats.dayVisits', { n: String(d.visits) })}
            />
            <span className="text-[10px] font-semibold tabular-nums text-faint">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
