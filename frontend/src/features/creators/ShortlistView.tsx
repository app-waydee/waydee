import { useEffect, useState } from 'react'
import { Bookmark, ChartNoAxesCombined, Download, ExternalLink, FileSearch, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { useT } from '@/i18n'
import { safeHref } from '@/lib/safeHref'
import type { ShortlistItem } from '@/lib/creators'
import { compact, creatorRow, displayName, downloadCsv, flagOf, percent, toCsv } from './creatorFormat'
import { InsightPanel } from './InsightPanel'
import { PlatformIcon } from './PlatformIcon'

/**
 * <b>Kısa liste</b> (108. tur) — InfluSense'in "Watchlists"inin ilk adımı.
 *
 * 109. tur: takipçi sayısı her gün sunucuda ölçülür (kredisiz); yapay zekâ
 * araştırması ("Detaylı veriler") yalnız kullanıcı istediğinde koşar ve ücretlidir —
 * kullanıcının haberi olmadan kredi harcanmaz.
 */
export function ShortlistView({
  items,
  loading,
  locale,
  onNote,
  onRemove,
  onOpenReport,
}: {
  items: ShortlistItem[] | undefined
  loading: boolean
  locale: string
  onNote: (id: string, note: string) => void
  onRemove: (id: string) => void
  onOpenReport: (id: string) => void
}) {
  const t = useT()
  const [insightId, setInsightId] = useState<string | null>(null)
  const insightItem = items?.find((it) => it.id === insightId) ?? null

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2" aria-hidden>
        {[0, 1].map((i) => <div key={i} className="waydee-ai-skel h-44" />)}
      </div>
    )
  }
  if (!items || items.length === 0) {
    return (
      <div className="waydee-cr-empty waydee-ai-panel">
        <Bookmark className="h-7 w-7 text-faint" />
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted">{t('creators.shortlistEmpty')}</p>
      </div>
    )
  }

  const exportCsv = () => {
    const header = (['rank', 'name', 'handle', 'platform', 'profile', 'country', 'language', 'followers', 'engagement',
      'avgViews', 'growth', 'cost', 'score', 'coverage', 'summary', 'note', 'sources'] as const)
      .map((k) => t(`creators.csv.${k}` as never))
    const rows = items.map((it) => creatorRow(it.creator, null, it.creator.score, locale, it.note))
    downloadCsv(`waydee-shortlist-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(header, rows, locale))
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button type="button" className="waydee-cr-btn" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" />
          {t('creators.exportCsv')}
        </button>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((it) => (
          <ShortlistCard key={it.id} item={it} locale={locale} onNote={onNote} onRemove={onRemove}
            onOpenReport={onOpenReport} onInsights={() => setInsightId(it.id)} />
        ))}
      </ul>
      {insightItem && <InsightPanel item={insightItem} locale={locale} onClose={() => setInsightId(null)} />}
    </>
  )
}

function ShortlistCard({ item, locale, onNote, onRemove, onOpenReport, onInsights }: {
  item: ShortlistItem
  locale: string
  onNote: (id: string, note: string) => void
  onRemove: (id: string) => void
  onOpenReport: (id: string) => void
  onInsights: () => void
}) {
  const t = useT()
  const c = item.creator
  const [note, setNote] = useState(item.note ?? '')
  // Sunucudan yeni bir not gelirse (başka bir sekmede düzenlendi) alan güncellenir.
  useEffect(() => setNote(item.note ?? ''), [item.note])
  const profile = /^https?:\/\//i.test(c.profileUrl) ? safeHref(c.profileUrl) : undefined
  const country = displayName(c.country, 'region', locale)

  return (
    <li className="waydee-cr-card">
      <header className="waydee-cr-card-head">
        <Avatar name={c.displayName || c.handle} src={c.avatarUrl ?? null} initialFallback className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="waydee-cr-name">{c.displayName}</h3>
          <p className="waydee-cr-sub">
            <PlatformIcon platform={c.platform} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">@{c.handle}</span>
            {country && <span className="shrink-0">· {flagOf(c.country)} {country}</span>}
          </p>
        </div>
      </header>
      <p className="waydee-cr-sub mt-2 flex-wrap">
        {c.followers != null && <span>{t('creators.followers')}: <strong className="text-ink">{compact(c.followers, locale)}</strong></span>}
        {c.engagementRatePct != null && <span>· {t('creators.engagement')}: <strong className="text-ink">{percent(c.engagementRatePct, locale)}</strong></span>}
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        /* Not, alandan çıkınca kaydedilir — her tuşta istek atılmaz.
           🔴 Değer ALANDAN okunur, durumdan değil (108. turda ölçüldü): yazma ile
           odak kaybı aynı karede olursa (otomatik doldurma, hızlı sekme geçişi)
           durum henüz güncellenmemiş olur ve not sessizce kaydedilmezdi. */
        onBlur={(e) => {
          const value = e.currentTarget.value
          if (value !== (item.note ?? '')) onNote(item.id, value)
        }}
        placeholder={t('creators.notePlaceholder')}
        rows={2}
        className="waydee-cr-note"
        aria-label={t('creators.notePlaceholder')}
      />
      <div className="waydee-cr-actions">
        {profile && (
          <a href={profile} target="_blank" rel="noopener noreferrer nofollow" className="waydee-cr-btn">
            <ExternalLink className="h-3.5 w-3.5" />
            {t('creators.openProfile')}
          </a>
        )}
        {item.sourceSearchId && (
          <button type="button" className="waydee-cr-btn" onClick={() => onOpenReport(item.sourceSearchId as string)}>
            <FileSearch className="h-3.5 w-3.5" />
            {t('creators.fromReport')}
          </button>
        )}
        <button type="button" className="waydee-cr-btn" data-on onClick={onInsights}>
          <ChartNoAxesCombined className="h-3.5 w-3.5" />
          {t('creators.insight.open')}
        </button>
        <button type="button" className="waydee-cr-btn-icon ms-auto" onClick={() => onRemove(item.id)}
          aria-label={t('creators.remove')} title={t('creators.remove')}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  )
}
