import { ChevronRight, FileSearch } from 'lucide-react'
import { useT } from '@/i18n'
import { timeAgo } from '@/lib/format'
import type { SearchSummary } from '@/lib/creators'
import { PlatformIcon } from './PlatformIcon'

/**
 * <b>Kayıtlı raporlar</b> (108. tur) — InfluSense'in "Saved Reports"u.
 *
 * ⚠️ Rapor açmak <b>yeniden arama değildir</b>: sonuç bir anlık görüntüdür ve
 * kredi düşmez. Kullanıcı aynı listeye istediği kadar dönebilir.
 */
export function ReportsList({
  items,
  loading,
  locale,
  onOpen,
}: {
  items: SearchSummary[] | undefined
  loading: boolean
  locale: string
  onOpen: (id: string) => void
}) {
  const t = useT()

  if (loading) {
    return (
      <div className="space-y-2" aria-hidden>
        {[0, 1, 2].map((i) => <div key={i} className="waydee-ai-skel h-[4.5rem]" />)}
      </div>
    )
  }
  if (!items || items.length === 0) {
    return (
      <div className="waydee-cr-empty waydee-ai-panel">
        <FileSearch className="h-7 w-7 text-faint" />
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted">{t('creators.reportsEmpty')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.id}>
          <button type="button" className="waydee-cr-report-row" onClick={() => onOpen(s.id)}>
            <span className="waydee-cr-status" data-s={s.status}>{t(`creators.status.${s.status}` as never)}</span>
            <span className="min-w-0 flex-1 text-start">
              <span className="waydee-cr-report-brief">{s.brief}</span>
              <span className="waydee-cr-report-meta">
                <span className="inline-flex items-center gap-1">
                  {s.platforms.map((p) => <PlatformIcon key={p} platform={p} className="h-3.5 w-3.5" />)}
                </span>
                {s.status === 'SUCCEEDED' && (
                  <span>{t('creators.resultsShort', { n: s.resultCount.toLocaleString(locale) })}</span>
                )}
                <span>{timeAgo(s.createdAt)}</span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-faint rtl:rotate-180" />
          </button>
        </li>
      ))}
    </ul>
  )
}
