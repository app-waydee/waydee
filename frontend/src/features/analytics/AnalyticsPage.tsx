import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bookmark, Heart, Image, Layers, Link2, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dropdown } from '@/components/ui/dropdown'
import { Spinner } from '@/components/ui/spinner'
import { fmtDate } from '@/lib/format'
import { useI18nStore } from '@/stores/i18n'
import { getMyReport } from '@/lib/analytics'
import { getMyMonetizationRequest } from '@/lib/monetization'
import { MonetizeDialog } from './MonetizeDialog'
import { LinkAnalytics } from './LinkAnalytics'
import { useT } from '@/i18n'
import type { ReportResponse } from '@/types/api'

/**
 * Analytics — <b>referans ekran görüntüsüyle birebir</b>.
 *
 * Yerleşim (görüntüden):
 * ```
 * Analytics                                   [Date Range ▾]
 * Track your profile performance and audience growth
 *
 * [Total Posts] [Total Likes]       [Total Saves]      ← 3 sütun
 * [Total Tags]  [Total Collections] [Total Links]
 *
 * ┌ Monetize Your Influence (ortalı, açıklama + siyah buton) ┐
 *
 * ┌ Profile Analytics / Showing total visitors trends ──────┐
 * │ [VISITORS] [SHARES] [VIEWS] [BOUNCE RATE]  ← mini kartlar│
 * │ yeşil alan grafiği                                       │
 * ```
 *
 * ⚠️ İkon karoları <b>pastel zemin + doygun ikon</b>: yeşil (gönderi/koleksiyon),
 * pembe (beğeni), sarı (kaydetme/etiket/bağlantı) — görüntüdeki renk kümesi.
 */
export function AnalyticsPage() {
  const t = useT()
  const [days, setDays] = useState(90)
  const [monetizeOpen, setMonetizeOpen] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['my-report', days],
    queryFn: () => getMyReport(days),
  })
  /* Başvuru durumu SUNUCUDAN okunur — başka cihazda da aynı görünmeli. */
  const requestQuery = useQuery({
    queryKey: ['monetization-request'],
    queryFn: getMyMonetizationRequest,
  })
  const request = requestQuery.data
  const status = request?.status ?? null
  const canApply = request?.canApply ?? true

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* --- başlık + dönem seçici --- */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('analytics.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('analytics.subtitle')}</p>
        </div>
        {/*
          🔴 16 Ağu 2026 — YERLİ `<select>` BIRAKILDI.
          Burada görünen kutu bizim işaretlememizdi ve üstüne `opacity-0` bir
          `select` bindirilmişti. Kullanıcı: *"dropdown çalışmıyor, CSS yemiyor,
          koyu modda açık renkte geliyor."* Üçü de doğruydu: açılan listeyi
          **işletim sistemi** çizer (CSS geçmez), rengini `color-scheme`
          belirler (bizim temamız `data-theme` ile döner) ve iki ayrı katman
          olduğu için tıklama kaçabiliyordu. Gerekçenin tamamı
          `components/ui/dropdown.tsx` başında.
        */}
        <Dropdown
          label={t('analytics.dateRange')}
          value={days}
          onChange={setDays}
          options={[
            { value: 7, label: t('analytics.range7') },
            { value: 30, label: t('analytics.range30') },
            { value: 90, label: t('analytics.range90') },
          ]}
        />
      </div>

      {/* --- 6 istatistik kartı (2 satır × 3 sütun) --- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={Image} tone="mint" label={t('analytics.totalPosts')} value={data?.postCount} loading={isLoading} />
        <Stat icon={Heart} tone="rose" label={t('analytics.totalLikes')} value={data?.likesReceived} loading={isLoading} />
        <Stat icon={Bookmark} tone="sand" label={t('analytics.totalSaves')} value={data?.saveCount} loading={isLoading} />
        <Stat icon={Tag} tone="sand" label={t('analytics.totalTags')} value={data?.tagCount} loading={isLoading} />
        <Stat icon={Layers} tone="mint" label={t('analytics.totalCollections')} value={data?.collectionCount} loading={isLoading} />
        <Stat icon={Link2} tone="sand" label={t('analytics.totalLinks')} value={data?.linkCount} loading={isLoading} />
      </div>

      {/*
        🔴 8 Ağu 2026 — MONETİZE KARTI ARTIK GERÇEK.
        Düğmenin `onClick`'i bile yoktu: tıklanınca hiçbir şey olmuyordu.
        Artık başvuru formu açılıyor, başvurunun durumu kartta gösteriliyor ve
        yönetici panelden karara bağlıyor.
        ⚠️ Durum sunucudan okunur, istemcide tutulmaz — kullanıcı başka bir
        cihazdan girdiğinde de aynı durumu görmeli.
      */}
      <div className="mt-6 rounded-2xl bg-surface p-8 text-center shadow-card md:p-10">
        <h2 className="text-xl font-bold">{t('analytics.monetizeTitle')}</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
          {t('analytics.monetizeDesc')}
        </p>

        {requestQuery.isLoading ? (
          <div className="mt-6 grid place-items-center">
            <Spinner />
          </div>
        ) : status && status !== 'APPROVED' && !canApply ? (
          /* Açık başvuru: durum rozeti + gönderim tarihi. */
          <div className="mt-6 flex flex-col items-center gap-2">
            <Badge tone={status === 'REVIEWING' ? 'info' : 'warning'}>
              {status === 'REVIEWING' ? t('analytics.monetizeReviewing') : t('analytics.monetizePending')}
            </Badge>
            <p className="text-[13px] text-muted">{t('analytics.monetizeWait')}</p>
          </div>
        ) : status === 'APPROVED' ? (
          <div className="mt-6 flex flex-col items-center gap-2">
            <Badge tone="success">{t('analytics.monetizeApproved')}</Badge>
            {request?.decisionNote && (
              <p className="max-w-lg text-[13px] leading-relaxed text-muted">{request.decisionNote}</p>
            )}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3">
            {/* Reddedilmişse gerekçe gösterilir — kullanıcı neyi düzelteceğini bilmeli. */}
            {status === 'REJECTED' && (
              <div className="flex flex-col items-center gap-1.5">
                <Badge tone="danger">{t('analytics.monetizeRejected')}</Badge>
                {request?.decisionNote && (
                  <p className="max-w-lg text-[13px] leading-relaxed text-muted">
                    {request.decisionNote}
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMonetizeOpen(true)}
              className="h-12 rounded-xl bg-ink px-8 text-sm font-semibold text-on-ink transition-opacity hover:opacity-90"
            >
              {status === 'REJECTED' ? t('analytics.monetizeReapply') : t('analytics.monetizeCta')}
            </button>
          </div>
        )}
      </div>

      {monetizeOpen && <MonetizeDialog onClose={() => setMonetizeOpen(false)} />}

      {/* --- Profile Analytics --- */}
      <div className="mt-6 rounded-2xl bg-surface p-5 shadow-card md:p-6">
        <h2 className="text-base font-bold">{t('analytics.profileTitle')}</h2>
        <p className="text-sm text-muted">{t('analytics.profileSubtitle')}</p>

        {/* 🔴 9 Ağu 2026 — BU BLOK SAHTE VERİ GÖSTERİYORDU:
            · üç kutunun da değişim rozeti sabit `0%` idi ve YEŞİL/ARTI
              tonundaydı — hiçbir hesaba dayanmıyordu;
            · "Hemen çıkma oranı" ölçülmediği hâlde değer olarak **%100**
              yazıyordu (`value ?? (na ? '100%' : 0)`), yani en kötü olası
              rakamı uyduruyordu;
            · "Toplam görüntülenme" dönem seçicisinden bağımsız `totalViews`
              okuyordu — 7 gün seçilince bile ömür boyu toplamı gösteriyordu.
            Artık dördü de yanıtta GERÇEKTEN duran alanlardan geliyor ve
            değişim yalnız sunucunun hesapladığı yerde (`changePercent`)
            yazılıyor. Ölçülemeyen bir metrik gösterilmiyor. */}
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Mini label={t('analytics.visitors')} value={data?.uniqueViewers} />
          <Mini
            label={t('analytics.views')}
            value={data?.viewsInPeriod}
            /* ⚠️ Önceki dönem 0 ise sunucu `null` döner (oran tanımsız);
               o durumda rozet HİÇ çizilmez — "%∞" ya da "%0" ikisi de yanlış. */
            delta={data?.changePercent ?? null}
          />
          <Mini label={t('analytics.shares')} value={data?.postsInPeriod} />
          <Mini label={t('analytics.likes')} value={data?.likesReceived} />
        </div>

        <VisitorsChart data={data} />
      </div>

      {/* 🔴 16 Ağu 2026 (V46) — BAĞLANTI TIKLAMA ANALİZİ.
          Bu bölüm yeni değil, <b>ilk kez gerçek</b>: sunucudaki tıklama sayacı
          hiç artmıyordu, yani bağlantı analizi her zaman sıfır gösteriyordu.
          Aynı dönem seçicisini kullanır — iki ayrı zaman aralığı, "rakamlar
          tutmuyor" şikâyetinin en kolay yolu olurdu. */}
      <LinkAnalytics days={days} />
    </div>
  )
}

const TONES = {
  mint: 'bg-mint-soft text-[#15803d]',
  rose: 'bg-[#ffe4ec] text-[#e11d48]',
  sand: 'bg-sand-soft text-[#b45309]',
} as const

function Stat({
  icon: Icon,
  tone,
  label,
  value,
  loading,
}: {
  icon: typeof Image
  tone: keyof typeof TONES
  label: string
  value?: number | null
  loading?: boolean
}) {
  return (
    <div className="waydee-stat">
      <span className={`waydee-stat-icon ${TONES[tone]}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <div className="waydee-stat-label">{label}</div>
        <div className="waydee-stat-value">{loading ? '—' : (value ?? 0)}</div>
      </div>
    </div>
  )
}

/**
 * Tek metrik kutusu.
 *
 * <p>⚠️ <b>Uydurma değer yok.</b> `value` gelmemişse <code>—</code> yazılır,
 * sıfır ya da yüzde uydurulmaz. `delta` yalnız sunucu bir oran hesapladıysa
 * çizilir ve <b>işaretine göre</b> renklenir — her rozeti yeşil/artı yapmak,
 * düşen bir metriği yükseliyormuş gibi gösteriyordu.
 */
function Mini({
  label,
  value,
  delta,
}: {
  label: string
  value?: number | null
  /** Yüzde değişim; ölçülemiyorsa `null` (rozet çizilmez). */
  delta?: number | null
}) {
  const locale = useI18nStore((s) => s.locale)
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta)
  const up = hasDelta && delta >= 0
  return (
    <div className="waydee-mini">
      <div className="waydee-mini-label">{label}</div>
      {/* ⚠️ Sayı biçimi de dile bağlıdır — sabit `tr-TR`, İngilizce arayüzde
          `1.234` (binlik ayracı nokta) gösteriyordu; beklenen `1,234`. */}
      <div className="waydee-mini-value">{value == null ? '—' : value.toLocaleString(locale)}</div>
      {hasDelta && (
        <span className={`waydee-delta ${up ? 'waydee-delta-up' : 'waydee-delta-down'}`}>
          {up ? '+' : ''}
          {Math.round(delta)}%
        </span>
      )}
    </div>
  )
}

/**
 * Ziyaretçi eğrisi — görüntüdeki <b>yumuşak yeşil alan</b> grafiği.
 *
 * ⚠️ Bağımlılıksız: tek bir SVG yolu. Grafik kütüphanesi eklemek yalnız bu
 * eğri için 40+ KB getirirdi ve projede zaten bağımlılıksız `BarChart` var.
 */
function VisitorsChart({ data }: { data?: ReportResponse }) {
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const points = data?.viewsByDay ?? []

  /*
   * 🔴 16 Ağu 2026 — "GRAFİKTE BARLAR OLUŞMUYOR" ŞİKÂYETİNİN KÖK NEDENİ.
   *
   * Boş durum kontrolü `points.length === 0` idi ve **hiçbir zaman doğru
   * olmuyordu**: sunucu diziyi SIFIRLARLA DOLDURUYOR (`AnalyticsService.
   * emptyDays`), yani 90 günlük bir istek her hâlükârda 90 satır döner.
   * Dolayısıyla kod "veri var" sanıp çizime giriyordu ve tüm sayılar 0 olduğu
   * için eğri `y = H`'de, yani **viewBox'ın tam alt kenarında** kalıyordu.
   * Çizginin yarısı kutunun dışında kaldığı için ekranda **hiçbir şey**
   * görünmüyordu.
   *
   * İki ayrı düzeltme gerekti:
   *  ① Boşluk kararı **toplama** bakar (`allZero`), dizi uzunluğuna değil.
   *  ② Çizim alanına **dikey pay** (`PAD`) kondu; eğri artık hiçbir değerde
   *     kenara yapışmaz ve kırpılmaz.
   *
   * ⚠️ Sıfır seriyi düz bir çizgi olarak çizip "grafik var" havası vermek
   * kolaydı ama vault kuralı net: **ölçülemeyen/olmayan veri gösterilmez.**
   */
  const allZero = points.every((p) => p.count === 0)
  if (points.length === 0 || allZero) {
    return (
      <p className="mt-6 grid h-48 place-items-center text-[13px] font-medium text-faint">
        {t('analytics.noViews')}
      </p>
    )
  }

  const max = Math.max(1, ...points.map((p) => p.count))
  const W = 100
  const H = 40
  /* Üstte ve altta pay: tepe noktası kutunun üst kenarına, sıfır günleri de
     alt kenarına yapışmasın. Kalın çizgide (2px) bu pay olmadan uçlar kesilir. */
  const PAD = 3
  const plot = H - PAD * 2
  const y = (count: number) => PAD + plot - (count / max) * plot
  /* ⚠️ TEK NOKTA: `points.length - 1` sıfır olur ve `step` **Infinity**'ye
     giderdi (0'a bölme) → `NaN` koordinat → yol hiç çizilmez. Tek günlük
     veride çizgi yatay çizilir. */
  const step = points.length > 1 ? W / (points.length - 1) : 0
  const coords = points.map((p, i) => [points.length > 1 ? i * step : W / 2, y(p.count)] as const)

  // Yumuşatma: kübik Bezier ile komşu noktalar arası geçiş.
  let line = coords
    .map(([x, py], i) => {
      if (i === 0) return `M ${x} ${py}`
      const [prevX, prevY] = coords[i - 1]
      const cx = (prevX + x) / 2
      return `C ${cx} ${prevY} ${cx} ${py} ${x} ${py}`
    })
    .join(' ')
  if (coords.length === 1) {
    // Tek nokta bir "çizgi" değildir; kenardan kenara yatay bir iz çizilir.
    line = `M 0 ${coords[0][1]} L ${W} ${coords[0][1]}`
  }
  const area = `${line} L ${W} ${H - PAD} L 0 ${H - PAD} Z`

  return (
    <div className="mt-6">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-48 w-full">
        <defs>
          <linearGradient id="waydee-visitors" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Taban çizgisi — eğrinin nereye göre okunacağını verir. */}
        <line
          x1="0"
          y1={H - PAD}
          x2={W}
          y2={H - PAD}
          stroke="var(--color-line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path d={area} fill="url(#waydee-visitors)" />
        {/*
          ⚠️ `preserveAspectRatio="none"` yüzünden şekil YATAYDA GERİLİR; bu da
          çizgi kalınlığını bozar. `vectorEffect="non-scaling-stroke"` kalınlığı
          piksel cinsinden sabitler — bu olmadan 90 günlük seride çizgi saç teli
          gibi inceliyordu.
        */}
        <path
          d={line}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* ⚠️ Tarihler HAM ISO dizesiydi (`2026-08-09`); tepe değeri de hiçbir
          yerde yazmadığı için eğrinin ölçeği okunamıyordu. */}
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>{fmtDate(points[0].date)}</span>
        <span className="font-semibold text-ink">
          {t('analytics.peak')}: {max.toLocaleString(locale)}
        </span>
        <span>{fmtDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  )
}
