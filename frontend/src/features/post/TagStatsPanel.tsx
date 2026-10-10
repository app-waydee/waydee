import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BarChart3, Loader2, MousePointerClick, Eye } from 'lucide-react'
import { getTagStats, type TagDaily } from '@/lib/tagStats'
import { useT } from '@/i18n'

/**
 * <b>Etiket rapor alanı</b> — gönderi detayında, yalnız <b>sahibine</b>.
 *
 * <p>Kullanıcı isteği: <i>"fotoğraflara etiketlediğimiz etiketlerin
 * istatistiklerini göreceğimiz bir geliştirme yap; paylaşılan fotoğraflara
 * tıklayınca da orda rapor alanı olsun."</i>
 *
 * <p>🔴 <b>16 Ağu 2026 — PANEL ARTIK TEK EKRANA SIĞAR.</b> Şikâyet:
 * <i>"istatistiklerin uzunluğu PC'de aşağı taşıyor; ne olursa olsun tek
 * ekranda, aşağı kaydırmaya gerek olmayacak şekilde olacak."</i> Doğruydu ve
 * sebebi panelin <b>yüksekliğinin veriye bağlı</b> olmasıydı: etiket kırılımı
 * düz bir liste olarak akıyordu, on etiketli bir gönderide panel fotoğraftan
 * uzun oluyor ve <b>pencerenin kendisini</b> ekranın altına taşırıyordu.
 *
 * <p>Çözüm üç parça:
 * <ol>
 *   <li>Panel bir <b>esnek sütun</b> ve yüksekliği <b>tavanlı</b>
 *       (`waydee-stats-body`): kap ne kadar uzarsa uzasın pencere büyümez.</li>
 *   <li>Kayan tek şey <b>etiket listesidir</b>; başlık, özet, grafik ve
 *       açıklama her zaman görünür kalır — kaydırınca kaybolan bir başlık,
 *       "hangi sayı neydi" sorusunu doğururdu.</li>
 *   <li>Özet üç kutu <b>yan yana</b> ve panel masaüstünde <b>genişletildi</b>
 *       (340 → 400px): dikeyde yer kazanmanın yolu yatayda yer vermekti
 *       (kullanıcı: <i>"gerekirse biraz yatay yap"</i>).</li>
 * </ol>
 *
 * <p>🔴 <b>GERİ DÜĞMESİ</b> (aynı istek: <i>"istatistik kısmına geri butonu
 * koymamışsın"</i>). Panel fotoğrafın yanında açılıyor ve kapatmanın tek yolu
 * <b>alttaki grafik simgesine yeniden basmaktı</b> — paneli okuyan kullanıcı o
 * düğmeyi görmüyordu bile. Artık panelin <b>en üstünde</b>, belirgin bir geri
 * düğmesi var ve doğrudan gönderi detayına döndürür.
 *
 * <p>⚠️ Bileşen <b>kendi kendini gizler</b>: sunucu sahibi olmayana 403
 * döndürür ve burada hiçbir şey çizilmez. Görünürlük kararını çağıran tarafa
 * bırakmak, o kontrolün bir yerde unutulması demekti.
 */
export function TagStatsPanel({
  postId,
  isOwner,
  onBack,
}: {
  postId: string
  isOwner: boolean
  /** Paneli kapatıp gönderi detayına dönen geri düğmesi. */
  onBack?: () => void
}) {
  const t = useT()
  const [days, setDays] = useState(30)

  const statsQuery = useQuery({
    queryKey: ['tag-stats', postId, days],
    queryFn: () => getTagStats(postId, days),
    /* ⚠️ Sahibi değilse istek HİÇ atılmaz: 403'ü alıp yutmak, her açılışta
       boşuna bir istek ve sunucu log'unda gürültü demekti. */
    enabled: isOwner && !!postId,
    retry: false,
  })

  if (!isOwner) return null

  if (statsQuery.isLoading) {
    return (
      <div className="grid place-items-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-faint" />
      </div>
    )
  }

  const stats = statsQuery.data
  if (!stats) return null

  const hasTags = stats.tags.length > 0

  return (
    <section className="waydee-stats-card">
      {/* -------------------------------------------------- geri + başlık */}
      {onBack && (
        <button type="button" onClick={onBack} className="waydee-stats-back">
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {t('common.back')}
        </button>
      )}

      <header className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold">
          <BarChart3 className="h-4 w-4" /> {t('tagStats.title')}
        </h3>
        {/* Pencere seçimi — 7 / 30 / 90 gün */}
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={
                'rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors ' +
                (days === d ? 'bg-ink text-on-ink' : 'bg-subtle text-muted')
              }
            >
              {t('tagStats.days').replace('{n}', String(d))}
            </button>
          ))}
        </div>
      </header>

      {!hasTags ? (
        <p className="text-[13px] font-medium text-muted">{t('tagStats.noTags')}</p>
      ) : (
        /* ⚠️ `min-h-0`: esnek bir sütunun içindeki kaydırılabilir alan
           `min-height:auto` yüzünden içeriği kadar büyür ve tavanı deler
           (vault kuralı — taşan esnek kaba min-w-0/min-h-0 ver). */
        <div className="flex min-h-0 flex-1 flex-col">
          {/* ---- özet: üç kutu YAN YANA (dikeyde yer kazanmanın yolu) ---- */}
          <div className="grid shrink-0 grid-cols-3 gap-2">
            <Stat
              icon={<Eye className="h-3.5 w-3.5" />}
              label={t('tagStats.impressions')}
              value={stats.totalImpressions}
            />
            <Stat
              icon={<MousePointerClick className="h-3.5 w-3.5" />}
              label={t('tagStats.clicks')}
              value={stats.totalClicks}
            />
            <Stat label={t('tagStats.ctr')} value={`%${stats.ctr}`} />
          </div>

          <MiniChart data={stats.daily} emptyLabel={t('tagStats.noData')} />

          {/* ---- etiket kırılımı: KAYAN TEK ALAN ---- */}
          <ul className="waydee-stats-list">
            {stats.tags.map((row) => (
              <li key={row.tagId} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {row.productName || t('tagStats.unnamed')}
                  </span>
                  {row.price != null && (
                    <span className="block truncate text-[12px] font-medium text-faint">
                      {row.price} {row.currency ?? ''}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right text-[12px] font-semibold tabular-nums">
                  <span className="block text-muted">
                    {row.impressions} / {row.clicks}
                  </span>
                  <span className="block text-faint">%{row.ctr}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 shrink-0 text-[11px] font-medium text-faint">{t('tagStats.legend')}</p>
        </div>
      )}
    </section>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: number | string
}) {
  return (
    <div className="min-w-0 rounded-xl bg-subtle px-2.5 py-2">
      <span className="flex items-center gap-1 truncate text-[10.5px] font-semibold uppercase tracking-wide text-faint">
        {icon}
        {label}
      </span>
      <span className="mt-0.5 block text-[16px] font-semibold tabular-nums">{value}</span>
    </div>
  )
}

/**
 * Bağımsız mini çubuk grafik.
 *
 * <p>⚠️ Grafik kütüphanesi EKLENMEDİ: projede zaten bağımlısız bir çizim
 * deseni var (`features/reports/ViewsChart`) ve tek bir panel için pakete
 * yüzlerce KB eklemek anlamsız.
 *
 * <p>⚠️ Boş günler sunucuda sıfırla dolduruluyor; burada tek yapılan
 * ölçekleme. Eksik günleri atlamak eğriyi olduğundan düz gösterirdi.
 *
 * <p>⚠️ Yükseklik artık `waydee-stats-chart` sınıfından gelir ve masaüstünde
 * <b>kısalır</b>: panel tek ekrana sığmak zorunda ve 80px'lik bir grafik,
 * asıl bilgiyi taşıyan etiket listesinden yer çalıyordu.
 */
function MiniChart({ data, emptyLabel }: { data: TagDaily[]; emptyLabel: string }) {
  const max = Math.max(1, ...data.map((d) => d.impressions))
  const any = data.some((d) => d.impressions > 0 || d.clicks > 0)

  if (!any) {
    return (
      <p className="mt-2.5 shrink-0 rounded-xl bg-subtle px-3 py-3 text-center text-[13px] font-medium text-muted">
        {emptyLabel}
      </p>
    )
  }

  return (
    /* ⚠️ `min-w-0` + `overflow-x-auto`: uzun pencerelerde (90 gün) çubuklar
       kabı taşırıp mobilde tüm sayfayı yatayda kaydırıyordu (vault kuralı). */
    <div className="mt-2.5 min-w-0 shrink-0 overflow-x-auto">
      <div className="waydee-stats-chart flex items-end gap-[2px]">
        {data.map((d) => (
          <span
            key={d.day}
            title={`${d.day} · ${d.impressions} / ${d.clicks}`}
            className="relative flex-1 rounded-t bg-subtle"
            style={{ minWidth: 3, height: `${Math.max((d.impressions / max) * 100, 2)}%` }}
          >
            {/* Tıklamalar aynı çubuğun içinde, koyu tonla */}
            {d.clicks > 0 && (
              <span
                className="absolute inset-x-0 bottom-0 rounded-t bg-ink"
                style={{ height: `${Math.min((d.clicks / Math.max(d.impressions, 1)) * 100, 100)}%` }}
              />
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
