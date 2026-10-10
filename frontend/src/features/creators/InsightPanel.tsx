import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, Handshake, LineChart, Loader2, RefreshCw, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Dialog } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { useT } from '@/i18n'
import { apiErrorMessage } from '@/lib/api'
import { safeHref } from '@/lib/safeHref'
import {
  getInsights,
  startInsights,
  type Basis,
  type InsightPhase,
  type InsightView,
  type InsightWindow,
  type ShortlistItem,
} from '@/lib/creators'
import { compact, displayName, flagOf, moneyRange, percent } from './creatorFormat'
import { PlatformIcon } from './PlatformIcon'

const PHASES: InsightPhase[] = ['PROFILE', 'RESEARCH', 'ANALYZE']

function externalHref(url: string | null | undefined): string | undefined {
  return url && /^https?:\/\//i.test(url.trim()) ? safeHref(url) : undefined
}

/**
 * <b>Detaylı veriler</b> (109. tur) — kısa listedeki bir üreticinin takip
 * grafiği, 7/14/30 gün metrikleri, iş birlikleri ve kitlesi.
 *
 * <ul>
 *   <li>Her sayının yanında kaynağı yazar: <b>Takip</b> (bizim ölçtüğümüz),
 *       <b>Gerçek</b> (sayfada yazıyor), <b>Ortalama</b> (platform/kademe
 *       ortalaması). Kullanıcı: "gerçek rakam olsun, olmazsa ortalama".</li>
 *   <li>Yenileme sürerken eski rapor görünmeye devam eder; yalnız üstte
 *       ilerleme şeridi çıkar.</li>
 *   <li>Takip grafiği her gün sunucuda ölçülür — kredi harcamaz.</li>
 * </ul>
 */
export function InsightPanel({ item, locale, onClose }: { item: ShortlistItem; locale: string; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const c = item.creator
  const key = ['creator-insight', item.id]

  const query = useQuery({
    queryKey: key,
    queryFn: () => getInsights(item.id),
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'QUEUED' || s === 'RUNNING' ? 2000 : false
    },
  })
  const view = query.data
  const running = view?.status === 'QUEUED' || view?.status === 'RUNNING'

  const start = useMutation({
    mutationFn: () => startInsights(item.id, locale),
    onSuccess: (v) => {
      qc.setQueryData(key, v)
      void qc.invalidateQueries({ queryKey: ['credits'] })
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('creators.error.INTERNAL'))),
  })

  const report = view?.report ?? null
  const failed = view?.status === 'FAILED'

  return (
    <Dialog open onClose={onClose} title={t('creators.insight.title')} className="max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Avatar name={c.displayName || c.handle} src={view?.avatarUrl ?? c.avatarUrl ?? null} initialFallback
          className="h-14 w-14 shrink-0" />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold tracking-tight">{c.displayName}</h3>
          <p className="waydee-cr-sub">
            <PlatformIcon platform={c.platform} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">@{c.handle}</span>
            {report && (
              <span className="shrink-0">· {compact(report.followers, locale)} {t('creators.followers').toLowerCase()}</span>
            )}
          </p>
        </div>
      </div>

      {query.isLoading && <div className="waydee-ai-skel h-48" aria-hidden />}

      {view && running && <Progress phase={view.phase} />}

      {view && failed && !running && (
        <div className="waydee-in-alert mb-4" role="status">
          <p className="font-semibold">{t('creators.insight.failedTitle')}</p>
          <p className="text-muted">
            {t(`creators.error.${view.errorCode && view.errorCode !== 'NOT_FOUND' ? view.errorCode : 'INTERNAL'}` as never)}
          </p>
          <p className="text-muted">{t('creators.insight.refunded', { n: view.cost })}</p>
        </div>
      )}

      {view && !report && !running && (
        <div className="waydee-in-intro">
          <Sparkles className="h-6 w-6 text-accent" />
          <h3 className="mt-3 text-base font-bold">{t('creators.insight.introTitle')}</h3>
          <ul className="waydee-in-intro-list">
            {(['intro1', 'intro2', 'intro3', 'intro4'] as const).map((k) => (
              <li key={k}><Check className="h-3.5 w-3.5 shrink-0 text-accent" />{t(`creators.insight.${k}`)}</li>
            ))}
          </ul>
          <button type="button" className="waydee-in-cta" disabled={start.isPending} onClick={() => start.mutate()}>
            {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t('creators.insight.fetch', { n: view.cost })}
          </button>
        </div>
      )}

      {view && <Tracking view={view} locale={locale} />}

      {report && view && (
        <ReportBody view={view} locale={locale} />
      )}

      {report && view && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {view.reportAt && (
            <span className="text-xs text-muted">
              {t('creators.insight.updated', { date: new Date(view.reportAt).toLocaleString(locale) })}
            </span>
          )}
          <button type="button" className="waydee-cr-btn ms-auto" disabled={running || start.isPending}
            onClick={() => start.mutate()}>
            <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
            {t('creators.insight.refresh', { n: view.cost })}
          </button>
        </div>
      )}
    </Dialog>
  )
}

function Progress({ phase }: { phase: InsightPhase | null }) {
  const t = useT()
  const current = phase ? PHASES.indexOf(phase) : 0
  return (
    <ol className="waydee-in-progress mb-5" aria-live="polite">
      {PHASES.map((p, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'queued'
        return (
          <li key={p} data-state={state}>
            <span className="waydee-in-progress-dot">
              {state === 'done' ? <Check className="h-3 w-3" /> : state === 'active' ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
            </span>
            <span>{t(`creators.insight.phase.${p}`)}</span>
          </li>
        )
      })}
    </ol>
  )
}

function BasisTag({ basis }: { basis: Basis }) {
  const t = useT()
  return (
    <span className="waydee-in-basis" data-basis={basis} title={t(`creators.insight.basisTip.${basis}`)}>
      {t(`creators.insight.basis.${basis}`)}
    </span>
  )
}

/** Listedeyken ölçülen takipçi serisi — kredi harcamaz, her gün sunucuda ölçülür. */
function Tracking({ view, locale }: { view: InsightView; locale: string }) {
  const t = useT()
  const pts = view.tracking.points
  const since = new Date(view.tracking.since).toLocaleDateString(locale)
  return (
    <section className="waydee-in-section">
      <header className="waydee-in-head">
        <LineChart className="h-4 w-4" />
        <h3>{t('creators.insight.trackingTitle')}</h3>
        <span className="ms-auto text-xs text-muted">{t('creators.insight.since', { date: since })}</span>
      </header>
      {pts.length >= 2 ? (
        <>
          <Sparkline points={pts} locale={locale} />
          {view.tracking.change != null && (
            <p className="mt-2 text-sm">
              <strong data-tone={view.tracking.change >= 0 ? 'up' : 'down'} className="waydee-in-delta">
                {view.tracking.change >= 0 ? '+' : ''}{compact(view.tracking.change, locale)}
                {view.tracking.changePct != null && ` (${percent(view.tracking.changePct, locale, true)})`}
              </strong>{' '}
              <span className="text-muted">{t('creators.insight.sinceAdded')}</span> <BasisTag basis="TRACKED" />
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">
          {pts.length === 1
            ? t('creators.insight.trackingStarted', { n: compact(pts[0].followers, locale) ?? '' })
            : t('creators.insight.trackingEmpty')}
        </p>
      )}
    </section>
  )
}

function Sparkline({ points, locale }: { points: { followers: number; at: string }[]; locale: string }) {
  const w = 600
  const h = 120
  const pad = 8
  const xs = points.map((p) => new Date(p.at).getTime())
  const ys = points.map((p) => p.followers)
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)]
  const sx = (x: number) => pad + ((x - x0) / Math.max(1, x1 - x0)) * (w - pad * 2)
  const sy = (y: number) => h - pad - ((y - y0) / Math.max(1, y1 - y0)) * (h - pad * 2)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(p.followers).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  return (
    <div className="waydee-in-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
        aria-label={`${compact(points[0].followers, locale)} → ${compact(last.followers, locale)}`}>
        <path d={`${d} L${sx(x1)},${h} L${sx(x0)},${h} Z`} className="waydee-in-chart-area" />
        <path d={d} className="waydee-in-chart-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-xs text-muted">
        <span>{new Date(points[0].at).toLocaleDateString(locale)} · {compact(points[0].followers, locale)}</span>
        <span>{new Date(last.at).toLocaleDateString(locale)} · {compact(last.followers, locale)}</span>
      </div>
    </div>
  )
}

function ReportBody({ view, locale }: { view: InsightView; locale: string }) {
  const t = useT()
  const r = view.report!
  const [days, setDays] = useState<7 | 14 | 30>(30)
  const w = r.windows.find((x) => x.days === days) ?? r.windows[r.windows.length - 1]
  const cost = moneyRange(r.estCostMin, r.estCostMax, r.costCurrency, locale)

  return (
    <>
      {r.summary && <p className="waydee-in-summary">{r.summary}</p>}

      <section className="waydee-in-section">
        <header className="waydee-in-head">
          <UsersRound className="h-4 w-4" />
          <h3>{t('creators.insight.performance')}</h3>
          <div className="waydee-ai-seg ms-auto" role="radiogroup" aria-label={t('creators.insight.period')}>
            {([7, 14, 30] as const).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={days === d} className="waydee-ai-seg-item"
                onClick={() => setDays(d)}>
                {t('creators.insight.days', { n: d })}
              </button>
            ))}
          </div>
        </header>
        <WindowGrid w={w} locale={locale} followers={r.followers} followersBasis={r.followersBasis} />
      </section>

      <section className="waydee-in-section">
        <header className="waydee-in-head">
          <Handshake className="h-4 w-4" />
          <h3>{t('creators.insight.collabs')}</h3>
          <span className="ms-auto text-xs text-muted">{r.collaborations.length}</span>
        </header>
        {r.collaborations.length === 0 ? (
          <p className="text-sm text-muted">{t('creators.insight.noCollabs')}</p>
        ) : (
          <ul className="waydee-in-collabs">
            {r.collaborations.map((col, i) => {
              const href = externalHref(col.url)
              return (
                <li key={`${col.brand}-${i}`}>
                  <span className="waydee-in-brand">{col.brand.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{col.brand}</p>
                    <p className="truncate text-xs text-muted">{[col.kind, col.date].filter(Boolean).join(' · ')}</p>
                  </div>
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="waydee-cr-btn-icon"
                      aria-label={t('creators.insight.openSource')} title={t('creators.insight.openSource')}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="waydee-in-section">
          <header className="waydee-in-head">
            <h3>{t('creators.insight.content')}</h3>
          </header>
          <dl className="waydee-in-facts">
            <div>
              <dt>{t('creators.insight.postsPerWeek')}</dt>
              <dd>{r.postsPerWeek.toLocaleString(locale)} <BasisTag basis={r.postsBasis} /></dd>
            </div>
            {r.bestFormat && <div><dt>{t('creators.insight.bestFormat')}</dt><dd>{r.bestFormat}</dd></div>}
            {cost && <div><dt>{t('creators.estCost')}</dt><dd>{cost}</dd></div>}
          </dl>
          {r.contentThemes.length > 0 && (
            <div className="waydee-cr-tags mt-3">
              {r.contentThemes.map((th) => <span key={th} className="waydee-cr-tag">{th}</span>)}
            </div>
          )}
        </section>

        {r.audience && (r.audience.topCountries.length > 0 || r.audience.femalePct != null || r.audience.mainAgeRange) && (
          <section className="waydee-in-section">
            <header className="waydee-in-head">
              <h3>{t('creators.insight.audience')}</h3>
              <span className="ms-auto"><BasisTag basis={r.audience.basis} /></span>
            </header>
            <dl className="waydee-in-facts">
              {r.audience.topCountries.length > 0 && (
                <div>
                  <dt>{t('creators.insight.topCountries')}</dt>
                  <dd>{r.audience.topCountries.map((cc) => `${flagOf(cc)} ${displayName(cc, 'region', locale) ?? cc}`).join(', ')}</dd>
                </div>
              )}
              {r.audience.femalePct != null && (
                <div>
                  <dt>{t('creators.insight.gender')}</dt>
                  <dd>{t('creators.insight.genderSplit', {
                    f: percent(r.audience.femalePct, locale) ?? '',
                    m: percent(100 - r.audience.femalePct, locale) ?? '',
                  })}</dd>
                </div>
              )}
              {r.audience.mainAgeRange && (
                <div><dt>{t('creators.insight.age')}</dt><dd>{r.audience.mainAgeRange}</dd></div>
              )}
            </dl>
          </section>
        )}
      </div>

      {(r.strengths.length > 0 || r.risks.length > 0) && (
        <div className="waydee-cr-reasons mt-4">
          {r.strengths.length > 0 && (
            <div>
              <span className="waydee-ai-label">{t('creators.strengths')}</span>
              <ul className="waydee-cr-list" data-kind="plus">{r.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {r.risks.length > 0 && (
            <div>
              <span className="waydee-ai-label">{t('creators.watchouts')}</span>
              <ul className="waydee-cr-list" data-kind="minus">{r.risks.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {r.sources.length > 0 && (
        <details className="waydee-in-sources">
          <summary>{t('creators.insight.sources', { n: r.sources.length })}</summary>
          <ul>
            {r.sources.map((s) => {
              const href = externalHref(s.url)
              return (
                <li key={s.url}>
                  {s.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent" />}
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="truncate">
                      {s.claim || new URL(s.url).hostname}
                    </a>
                  ) : <span className="truncate">{s.claim}</span>}
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </>
  )
}

function WindowGrid({ w, locale, followers, followersBasis }: {
  w: InsightWindow
  locale: string
  followers: number
  followersBasis: Basis
}) {
  const t = useT()
  const growth = w.followerGrowthPct
  const cells: { label: string; value: string; basis: Basis; tone?: 'up' | 'down' }[] = [
    { label: t('creators.followers'), value: compact(followers, locale) ?? '', basis: followersBasis },
    {
      label: t('creators.insight.followerChange'),
      value: w.followerChange != null
        ? `${w.followerChange >= 0 ? '+' : ''}${compact(w.followerChange, locale)} (${percent(growth, locale, true)})`
        : percent(growth, locale, true) ?? '',
      basis: w.growthBasis,
      tone: growth == null ? undefined : growth > 0 ? 'up' : growth < 0 ? 'down' : undefined,
    },
    { label: t('creators.engagement'), value: percent(w.engagementRatePct, locale) ?? '', basis: w.basis },
    { label: t('creators.avgViews'), value: compact(w.avgViews, locale) ?? '', basis: w.basis },
    { label: t('creators.insight.avgLikes'), value: compact(w.avgLikes, locale) ?? '', basis: w.basis },
    { label: t('creators.insight.avgComments'), value: compact(w.avgComments, locale) ?? '', basis: w.basis },
    { label: t('creators.insight.posts'), value: w.posts.toLocaleString(locale), basis: w.basis },
  ]
  return (
    <dl className="waydee-in-grid">
      {cells.map((cell) => (
        <div key={cell.label} className="waydee-in-cell">
          <dt>{cell.label}</dt>
          <dd data-tone={cell.tone}>{cell.value}</dd>
          <BasisTag basis={cell.basis} />
        </div>
      ))}
    </dl>
  )
}
