import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Globe2, MousePointerClick, UserRound, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import { getLinkStats } from '@/lib/linkStats'
import { timeAgo } from '@/lib/format'
import { useT } from '@/i18n'
import { useI18nStore } from '@/stores/i18n'

/**
 * <b>Bağlantı tıklama analizi</b> (V46).
 *
 * <h3>🔴 Neden yeniden yazıldı</h3>
 * <p>Kullanıcı: <i>"link tıklama analizi inanılmaz sorunlu, baştan sona
 * düzelt; hangi ülkelerden tıklandığını da göster, gerçek user bilgisi
 * olsun."</i> Ortada bozuk bir ekran yoktu — <b>ölçümün kendisi yoktu</b>:
 * sunucudaki sayaç hiç artmıyordu, yani her bağlantı sonsuza kadar "0 tıklama"
 * gösteriyordu.
 *
 * <h3>⚠️ Ülke adları SUNUCUDAN GELMEZ</h3>
 * <p>Sunucu yalnız <b>ISO kodu</b> döndürür ({@code TR}, {@code DE}); adı
 * burada {@code Intl.DisplayNames} üretir. Böylece beş dilin hepsi ülke adını
 * <b>kendi dilinde</b> görür ve sözlüğe yüzlerce ülke adı yazmak gerekmez.
 * (Vault kuralı, 83. tur: sunucudan gelen {@code *Label} alanları basılmaz.)
 *
 * <h3>⚠️ Ölçülemeyen şey gösterilmez</h3>
 * <p>Ülkesi bilinmeyen tıklamalar <b>gizlenmez</b>, "Bilinmiyor" olarak
 * sayılır: elemek toplamı bozar ve "rakamlar tutmuyor" şikâyeti doğurur.
 * Ülke bilgisi CDN başlığından gelir; yerelde bu başlık yoktur ve orada
 * hepsi bilinmiyendir — bu bir arıza değildir.
 */
export function LinkAnalytics({ days }: { days: number }) {
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const { data, isLoading } = useQuery({
    queryKey: ['link-stats', days],
    queryFn: () => getLinkStats(days),
  })

  /* ⚠️ `Intl.DisplayNames` her çizimde yeniden kurulmaz: dil değişmedikçe
     aynı örnek kullanılır (kurulumu ucuz değildir). */
  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' })
    } catch {
      return null
    }
  }, [locale])

  const countryLabel = (code: string | null) => {
    if (!code) return t('linkStats.unknownCountry')
    try {
      return regionNames?.of(code) ?? code
    } catch {
      return code
    }
  }

  if (isLoading) {
    return (
      <div className="mt-6 grid place-items-center rounded-2xl bg-surface p-10 shadow-card">
        <Spinner />
      </div>
    )
  }
  if (!data) return null

  const maxCountry = Math.max(1, ...data.countries.map((c) => c.clicks))

  return (
    <div className="mt-6 rounded-2xl bg-surface p-5 shadow-card md:p-6">
      <h2 className="text-base font-bold">{t('linkStats.title')}</h2>
      <p className="text-sm text-muted">{t('linkStats.subtitle')}</p>

      {/* --- üç özet --- */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Mini icon={MousePointerClick} label={t('linkStats.clicks')} value={data.clicks} locale={locale} />
        <Mini icon={Users} label={t('linkStats.visitors')} value={data.visitors} locale={locale} />
        <Mini icon={UserRound} label={t('linkStats.identified')} value={data.identified} locale={locale} />
      </div>

      {/* --- bağlantı bazında --- */}
      <div className="mt-6">
        <h3 className="waydee-ai-label-inline mb-2.5">{t('linkStats.perLink')}</h3>
        {data.links.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-faint">{t('home.noLinks')}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line">
            {data.links.map((l, i) => (
              <div
                key={l.id}
                className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-subtle text-muted">
                  {l.iconUrl ? (
                    <img src={l.iconUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{l.title}</span>
                  <span className="block truncate text-[11px] font-medium text-faint">{l.url}</span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="block text-[15px] font-bold tabular-nums">
                    {l.clicks.toLocaleString(locale)}
                  </span>
                  {/* ⚠️ Tekil ziyaretçi AYRI gösterilir: on tıklamanın bir
                      kişiden gelmesi ile on kişiden gelmesi aynı şey değil. */}
                  <span className="block text-[11px] font-medium text-faint">
                    {t('linkStats.visitorsShort', { count: l.visitors.toLocaleString(locale) })}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- ülke kırılımı --- */}
      <div className="mt-6">
        <h3 className="waydee-ai-label-inline mb-2.5 flex items-center gap-2">
          <Globe2 className="h-3.5 w-3.5 text-faint" />
          {t('linkStats.byCountry')}
        </h3>
        {data.countries.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-faint">{t('linkStats.noClicks')}</p>
        ) : (
          <div className="space-y-2">
            {data.countries.map((c) => (
              <div key={c.code ?? 'unknown'} className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-center text-[15px]" aria-hidden>
                  {flagOf(c.code)}
                </span>
                <span className="w-32 shrink-0 truncate text-[13px] font-medium">
                  {countryLabel(c.code)}
                </span>
                {/* Oran çubuğu — en çok tıklanan ülkeye göre. */}
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-subtle">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(4, (c.clicks / maxCountry) * 100)}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-end text-[13px] font-semibold tabular-nums">
                  {c.clicks.toLocaleString(locale)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- son tıklayanlar --- */}
      <div className="mt-6">
        <h3 className="waydee-ai-label-inline mb-2.5">{t('linkStats.recent')}</h3>
        {data.recent.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-faint">{t('linkStats.noClicks')}</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {data.recent.map((v, i) => (
              <div key={`${v.at}-${i}`} className="flex items-center gap-3 py-2">
                {/* ⚠️ Oturum açmamış ziyaretçi bir KİŞİ olarak gösterilmez:
                    boş bir avatar + gerçek ad yerine "ziyaretçi" yazılır.
                    Veriyi olduğundan zengin göstermemenin tek dürüst yolu. */}
                {v.username ? (
                  <Avatar src={v.avatarUrl ?? undefined} name={v.displayName ?? v.username} className="h-8 w-8" />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-subtle text-faint">
                    <UserRound className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {v.username ? (v.displayName ?? v.username) : t('linkStats.anonymous')}
                    {v.username && <span className="ms-1 font-medium text-faint">@{v.username}</span>}
                  </span>
                  <span className="block truncate text-[11px] font-medium text-faint">
                    {v.linkTitle} · {flagOf(v.country)} {countryLabel(v.country)}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-medium text-faint">{timeAgo(v.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * ISO kodundan bayrak emojisi.
 *
 * <p>Bölgesel gösterge harfleri: {@code A} → U+1F1E6. İki harf yan yana
 * gelince işletim sistemi bayrağı çizer.
 * <p>⚠️ Kod yoksa <b>dünya</b> işareti — boş bırakmak satırı hizasız gösterirdi.
 */
function flagOf(code: string | null): string {
  if (!code || code.length !== 2) return '🌍'
  const base = 0x1f1e6
  const upper = code.toUpperCase()
  return String.fromCodePoint(base + upper.charCodeAt(0) - 65, base + upper.charCodeAt(1) - 65)
}

function Mini({
  icon: Icon,
  label,
  value,
  locale,
}: {
  icon: typeof Users
  label: string
  value: number
  locale: string
}) {
  return (
    <div className="waydee-mini">
      <div className="waydee-mini-label flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="waydee-mini-value">{value.toLocaleString(locale)}</div>
    </div>
  )
}
