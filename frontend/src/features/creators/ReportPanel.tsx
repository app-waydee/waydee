import { useMemo, useState } from 'react'
import { ChevronDown, Download, Plus, RotateCw, SlidersHorizontal, Telescope } from 'lucide-react'
import { useT } from '@/i18n'
import {
  SIGNALS,
  type Creator,
  type DropReason,
  type Platform,
  type SearchDetail,
  type Signal,
  type Weights,
} from '@/lib/creators'
import { CreatorCard } from './CreatorCard'
import { creatorRow, downloadCsv, toCsv } from './creatorFormat'
import { Pipeline } from './Pipeline'
import { PlatformIcon } from './PlatformIcon'
import { rank } from './scoring'
import { WeightsRadar } from './WeightsRadar'

/**
 * <b>Rapor paneli</b> (108. tur) — seçili aramanın canlı ya da bitmiş hâli.
 */
export function ReportPanel({
  search,
  loading,
  locale,
  weights,
  onWeightsChange,
  savedIds,
  savingId,
  onSave,
  onSimilar,
  onRetry,
  onNew,
}: {
  search: SearchDetail | undefined
  loading: boolean
  locale: string
  weights: Weights
  onWeightsChange: (w: Weights) => void
  /** Kısa listedeki `PLATFORM:handle` kimlikleri (küçük harf). */
  savedIds: Set<string>
  savingId: string | null
  onSave: (creator: Creator) => void
  onSimilar: (creator: Creator) => void
  onRetry: () => void
  onNew: () => void
}) {
  const t = useT()

  if (!search) {
    return loading ? <SkeletonReport /> : <HowItWorks />
  }

  const running = search.status === 'QUEUED' || search.status === 'RUNNING'

  return (
    <div className="waydee-ai-panel waydee-cr-report">
      {search.criteria?.summary && (
        <div className="waydee-cr-understood">
          <span className="waydee-ai-label">{t('creators.understood')}</span>
          <p>{search.criteria.summary}</p>
        </div>
      )}

      {running && (
        <>
          <Pipeline steps={search.steps} locale={locale} startedAt={search.startedAt ?? search.createdAt} running />
          <p className="waydee-cr-hint mt-4">{t('creators.runningHint')}</p>
          <div className="mt-5 space-y-3" aria-hidden>
            <div className="waydee-ai-skel h-40" />
            <div className="waydee-ai-skel h-40" />
          </div>
        </>
      )}

      {search.status === 'FAILED' && (
        <>
          <Pipeline steps={search.steps} locale={locale} startedAt={search.startedAt} running={false} />
          <div className="waydee-cr-failed">
            <p className="font-semibold text-ink">{t('creators.failedTitle')}</p>
            <p className="mt-1">{t(`creators.error.${search.errorCode ?? 'INTERNAL'}` as never)}</p>
            <p className="mt-1">{t('creators.refunded', { credits: search.cost.toLocaleString(locale) })}</p>
            <button type="button" className="waydee-cr-btn mt-3" onClick={onRetry}>
              <RotateCw className="h-3.5 w-3.5" />
              {t('creators.retry')}
            </button>
          </div>
        </>
      )}

      {search.status === 'SUCCEEDED' && (
        <Results
          search={search}
          locale={locale}
          weights={weights}
          onWeightsChange={onWeightsChange}
          savedIds={savedIds}
          savingId={savingId}
          onSave={onSave}
          onSimilar={onSimilar}
          onNew={onNew}
        />
      )}
    </div>
  )
}

function Results({
  search,
  locale,
  weights,
  onWeightsChange,
  savedIds,
  savingId,
  onSave,
  onSimilar,
  onNew,
}: {
  search: SearchDetail
  locale: string
  weights: Weights
  onWeightsChange: (w: Weights) => void
  savedIds: Set<string>
  savingId: string | null
  onSave: (creator: Creator) => void
  onSimilar: (creator: Creator) => void
  onNew: () => void
}) {
  const t = useT()
  const [platform, setPlatform] = useState<Platform | 'ALL'>('ALL')
  const [tuneOpen, setTuneOpen] = useState(false)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [droppedOpen, setDroppedOpen] = useState(false)

  const results = useMemo(() => search.results ?? [], [search.results])
  const ranked = useMemo(() => rank(results, weights), [results, weights])
  const visible = platform === 'ALL' ? ranked : ranked.filter((c) => c.platform === platform)
  const platforms = useMemo(() => [...new Set(results.map((c) => c.platform))], [results])

  /* Bu aramada hesaba katılan sinyaller: herhangi bir sonuçta anahtarı varsa.
     ⚠️ Anahtarın olmaması = kullanıcı o boyutu istemedi (bkz. Creator.signals). */
  const applicable = useMemo(() => {
    const set = new Set<Signal>()
    for (const c of results) for (const s of SIGNALS) if (s in c.signals) set.add(s)
    return set
  }, [results])

  const dropped = search.dropped ?? []
  const droppedByReason = useMemo(() => {
    const map = new Map<DropReason, number>()
    for (const d of dropped) map.set(d.reason, (map.get(d.reason) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [dropped])

  const exportCsv = () => {
    const header = (['rank', 'name', 'handle', 'platform', 'profile', 'country', 'language', 'followers', 'engagement',
      'avgViews', 'growth', 'cost', 'score', 'coverage', 'summary', 'note', 'sources'] as const)
      .map((k) => t(`creators.csv.${k}` as never))
    const rows = ranked.map((c, i) => creatorRow(c, i + 1, c.live, locale))
    downloadCsv(`waydee-influencer-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(header, rows, locale))
  }

  if (results.length === 0) {
    return (
      <>
        <div className="waydee-cr-empty">
          <Telescope className="h-7 w-7 text-faint" />
          <p className="mt-3 text-base font-bold">{t('creators.noResultsTitle')}</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{t('creators.noResultsDesc')}</p>
          <button type="button" className="waydee-cr-btn mt-4" onClick={onNew}>
            <Plus className="h-3.5 w-3.5" />
            {t('creators.newSearch')}
          </button>
        </div>
        <DroppedBlock open droppedByReason={droppedByReason} total={dropped.length} onToggle={() => {}} hideToggle />
        <StepsDisclosure search={search} locale={locale} open={stepsOpen} onToggle={() => setStepsOpen((v) => !v)} />
      </>
    )
  }

  return (
    <>
      <div className="waydee-cr-results-head">
        <h2 className="text-lg font-bold tracking-tight">
          {t('creators.resultsTitle', { n: results.length.toLocaleString(locale) })}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="waydee-cr-btn" aria-expanded={tuneOpen} data-on={tuneOpen || undefined}
            onClick={() => setTuneOpen((v) => !v)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('creators.tune')}
          </button>
          <button type="button" className="waydee-cr-btn" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
            {t('creators.exportCsv')}
          </button>
          <button type="button" className="waydee-cr-btn" onClick={onNew}>
            <Plus className="h-3.5 w-3.5" />
            {t('creators.newSearch')}
          </button>
        </div>
      </div>

      {tuneOpen && (
        <div className="waydee-cr-tune">
          <p className="waydee-cr-hint mb-3">{t('creators.tuneDesc')}</p>
          <WeightsRadar weights={weights} onChange={onWeightsChange} applicable={applicable} />
        </div>
      )}

      {platforms.length > 1 && (
        <div className="waydee-cr-chips mb-4" role="group">
          <button type="button" className="waydee-cr-chip" aria-pressed={platform === 'ALL'} onClick={() => setPlatform('ALL')}>
            {t('creators.filterAll')}
          </button>
          {platforms.map((p) => (
            <button key={p} type="button" className="waydee-cr-chip" aria-pressed={platform === p} onClick={() => setPlatform(p)}>
              <PlatformIcon platform={p} className="h-3.5 w-3.5" />
              {t(`creators.platform.${p}` as never)}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {visible.map((c) => (
          <CreatorCard
            key={c.id}
            creator={c}
            rank={ranked.indexOf(c) + 1}
            score={c.live}
            locale={locale}
            saved={savedIds.has(c.id.toLowerCase())}
            saving={savingId === c.id}
            onSave={() => onSave(c)}
            onSimilar={() => onSimilar(c)}
          />
        ))}
      </div>

      {dropped.length > 0 && (
        <DroppedBlock open={droppedOpen} droppedByReason={droppedByReason} total={dropped.length}
          onToggle={() => setDroppedOpen((v) => !v)} />
      )}
      <StepsDisclosure search={search} locale={locale} open={stepsOpen} onToggle={() => setStepsOpen((v) => !v)} />
    </>
  )
}

function DroppedBlock({
  open,
  droppedByReason,
  total,
  onToggle,
  hideToggle,
}: {
  open: boolean
  droppedByReason: [DropReason, number][]
  total: number
  onToggle: () => void
  hideToggle?: boolean
}) {
  const t = useT()
  if (total === 0) return null
  return (
    <div className="waydee-cr-dropped">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{t('creators.droppedSummary', { n: total })}</span>
        {!hideToggle && (
          <button type="button" className="waydee-cr-link" onClick={onToggle} aria-expanded={open}>
            {open ? t('creators.hideDropped') : t('creators.showDropped')}
          </button>
        )}
      </div>
      {open && (
        <ul className="waydee-cr-dropped-list">
          {droppedByReason.map(([reason, n]) => (
            <li key={reason}>
              <span>{t(`creators.drop.${reason}` as never)}</span>
              <span className="tabular-nums text-muted">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StepsDisclosure({ search, locale, open, onToggle }: {
  search: SearchDetail
  locale: string
  open: boolean
  onToggle: () => void
}) {
  const t = useT()
  return (
    <div className="mt-5 border-t border-line pt-4">
      <button type="button" className="waydee-cr-disclosure" aria-expanded={open} onClick={onToggle}>
        <span className="waydee-ai-label-inline">{t('creators.pipelineTitle')}</span>
        <ChevronDown className={`ms-auto h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3">
          <Pipeline steps={search.steps} locale={locale} startedAt={search.startedAt} running={false} />
        </div>
      )}
    </div>
  )
}

/** Boş durum — InfluSense'in "How it works" üçlüsünün karşılığı + güven cümlesi. */
function HowItWorks() {
  const t = useT()
  return (
    <div className="waydee-ai-panel">
      <span className="waydee-ai-label">{t('creators.howTitle')}</span>
      <ol className="waydee-cr-how">
        {([1, 2, 3] as const).map((n) => (
          <li key={n}>
            <span className="waydee-cr-how-num">{n.toString().padStart(2, '0')}</span>
            <div>
              <p className="font-semibold text-ink">{t(`creators.how${n}Title`)}</p>
              <p className="mt-0.5 text-sm text-muted">{t(`creators.how${n}Desc`)}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="waydee-cr-trust">{t('creators.trust')}</p>
    </div>
  )
}

function SkeletonReport() {
  return (
    <div className="waydee-ai-panel space-y-3" aria-hidden>
      <div className="waydee-ai-skel h-6 w-1/3" />
      <div className="waydee-ai-skel h-40" />
      <div className="waydee-ai-skel h-40" />
    </div>
  )
}
