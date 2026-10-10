import { useState } from 'react'
import { Bookmark, BookmarkCheck, ChevronDown, Copy, ExternalLink, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
import { useT } from '@/i18n'
import { safeHref } from '@/lib/safeHref'
import { SIGNALS, type Creator, type Signal } from '@/lib/creators'
import { compact, displayName, flagOf, moneyRange, percent } from './creatorFormat'
import { PlatformIcon } from './PlatformIcon'

/**
 * Modelden gelen dış bağlantı yalnız http(s) olabilir.
 * ⚠️ `safeHref` göreli adresleri de geçirir (uygulama içi bağlantılar için
 * doğru); burada ise adres web'den geliyor ve göreli bir yol bizim
 * uygulamamızın içine işaret ederdi.
 */
function externalHref(url: string | null | undefined): string | undefined {
  return url && /^https?:\/\//i.test(url.trim()) ? safeHref(url) : undefined
}

/**
 * <b>Sonuç kartı</b> (108. tur).
 *
 * <ul>
 *   <li>Bilinmeyen metrik <b>"—"</b> ve açıklaması — sıfır yazılmaz
 *       (InfluSense: "missing data does not mean zero").</li>
 *   <li>"Neden bu sırada?" sekiz sinyalin çubuğunu, lehine/dikkat
 *       gerekçelerini ve kaynakları açar; puan bir kara kutu değildir.</li>
 *   <li>Profil görseli <b>yok</b>: platform CDN'lerindeki görseller kısa
 *       sürede geçersizleşir ve başka bir sitenin görselini sıcak bağlamak
 *       (hotlink) o platformun kurallarına aykırıdır. Baş harf avatarı kullanılır.</li>
 * </ul>
 */
export function CreatorCard({
  creator,
  rank,
  score,
  locale,
  saved,
  saving,
  onSave,
  onSimilar,
}: {
  creator: Creator
  rank: number
  score: number
  locale: string
  saved: boolean
  saving: boolean
  onSave: () => void
  onSimilar: () => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const c = creator
  const country = displayName(c.country, 'region', locale)
  const language = displayName(c.language, 'language', locale)
  const profile = externalHref(c.profileUrl)

  const copyHandle = async () => {
    try {
      await navigator.clipboard.writeText(`@${c.handle}`)
      toast.success(t('creators.copied'))
    } catch {
      // Pano izni yoksa sessizce geçilir — kullanıcı adı zaten ekranda yazılı.
    }
  }

  return (
    <article className="waydee-cr-card">
      <header className="waydee-cr-card-head">
        <span className="waydee-cr-rank">{rank}</span>
        <Avatar name={c.displayName || c.handle} src={c.avatarUrl ?? null} initialFallback className="h-11 w-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="waydee-cr-name" title={c.displayName}>{c.displayName}</h3>
            {c.momentum !== 'UNKNOWN' && (
              <span className="waydee-cr-momentum" data-m={c.momentum}>
                {t(`creators.momentum.${c.momentum}` as never)}
              </span>
            )}
          </div>
          <p className="waydee-cr-sub">
            <PlatformIcon platform={c.platform} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">@{c.handle}</span>
            {country && <span className="shrink-0" title={country}>· {flagOf(c.country)} {country}</span>}
            {language && <span className="hidden shrink-0 sm:inline">· {language}</span>}
          </p>
        </div>
        <div className="waydee-cr-score" title={t('creators.coverage', { n: Math.round(c.coverage * 100) })}>
          <ScoreRing value={score} />
          <span className="waydee-cr-score-label">{t('creators.score')}</span>
        </div>
      </header>

      <dl className="waydee-cr-metrics">
        {/* 8 Eki 2026, kullanıcı: "boş veri olmasın" — bulunamayan metrik kutusu hiç çizilmez. */}
        <Metric label={t('creators.followers')} value={compact(c.followers, locale)} />
        <Metric label={t('creators.engagement')} value={percent(c.engagementRatePct, locale)} />
        <Metric label={t('creators.avgViews')} value={compact(c.avgViews, locale)} />
        <Metric label={t('creators.growth')} value={percent(c.growth30dPct, locale, true)}
          tone={c.growth30dPct == null ? undefined : c.growth30dPct > 0 ? 'up' : c.growth30dPct < 0 ? 'down' : undefined} />
        <Metric label={t('creators.estCost')} value={moneyRange(c.estCostMin, c.estCostMax, c.costCurrency, locale)} wide />
      </dl>

      {c.summary && <p className="waydee-cr-summary">{c.summary}</p>}

      {c.categories.length > 0 && (
        <div className="waydee-cr-tags">
          {c.categories.map((cat) => (
            <span key={cat} className="waydee-cr-tag">{t(`creators.cat.${cat}` as never)}</span>
          ))}
        </div>
      )}

      <div className="waydee-cr-actions">
        {profile && (
          <a href={profile} target="_blank" rel="noopener noreferrer nofollow" className="waydee-cr-btn">
            <ExternalLink className="h-3.5 w-3.5" />
            {t('creators.openProfile')}
          </a>
        )}
        <button type="button" onClick={onSave} disabled={saved || saving} className="waydee-cr-btn" data-on={saved || undefined}>
          {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          {saved ? t('creators.saved') : t('creators.save')}
        </button>
        <button type="button" onClick={onSimilar} className="waydee-cr-btn">
          <UsersRound className="h-3.5 w-3.5" />
          {t('creators.similar')}
        </button>
        <button type="button" onClick={copyHandle} className="waydee-cr-btn-icon" aria-label={t('creators.copyHandle')}
          title={t('creators.copyHandle')}>
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} className="waydee-cr-why" aria-expanded={open}>
          {open ? t('creators.hideWhy') : t('creators.why')}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="waydee-cr-detail">
          <div className="waydee-cr-signals">
            {SIGNALS.map((s) => (
              <SignalBar key={s} signal={s} value={c.signals[s]} applicable={s in c.signals} />
            ))}
            <p className="waydee-cr-coverage">{t('creators.coverage', { n: Math.round(c.coverage * 100) })}</p>
          </div>

          {(c.fitReasons.length > 0 || c.watchouts.length > 0) && (
            <div className="waydee-cr-reasons">
              {c.fitReasons.length > 0 && (
                <div>
                  <span className="waydee-ai-label">{t('creators.strengths')}</span>
                  <ul className="waydee-cr-list" data-kind="plus">
                    {c.fitReasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {c.watchouts.length > 0 && (
                <div>
                  <span className="waydee-ai-label">{t('creators.watchouts')}</span>
                  <ul className="waydee-cr-list" data-kind="warn">
                    {c.watchouts.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {c.evidence.length > 0 && (
            <div>
              <span className="waydee-ai-label">{t('creators.evidence')}</span>
              <ul className="waydee-cr-evidence">
                {c.evidence.map((e) => {
                  const href = externalHref(e.url)
                  return (
                    <li key={e.url}>
                      <span className="waydee-cr-evidence-mark" data-verified={e.verified || undefined}
                        title={e.verified ? t('creators.verified') : t('creators.unverified')}>
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        {href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="waydee-cr-evidence-link">
                            {e.title || hostOf(e.url)}
                          </a>
                        ) : (
                          <span className="waydee-cr-evidence-link">{e.title || e.url}</span>
                        )}
                        {e.claim && <p className="waydee-cr-evidence-claim">{e.claim}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function Metric({ label, value, tone, wide }: { label: string; value: string | null; tone?: 'up' | 'down'; wide?: boolean }) {
  if (value == null) return null
  return (
    <div className="waydee-cr-metric" data-wide={wide || undefined}>
      <dt>{label}</dt>
      <dd data-tone={tone}>{value}</dd>
    </div>
  )
}

function SignalBar({ signal, value, applicable }: { signal: Signal; value: number | null | undefined; applicable: boolean }) {
  const t = useT()
  const label = t(`creators.signal.${signal}` as never)
  const state = !applicable ? 'off' : value == null ? 'unknown' : 'on'
  return (
    <div className="waydee-cr-signal" data-state={state} title={t(`creators.signalDesc.${signal}` as never)}>
      <span className="waydee-cr-signal-name">
        {label}
        {signal === 'CONTENT_FIT' && <Sparkles className="h-3 w-3 text-violet" aria-label={t('creators.aiJudged')} />}
      </span>
      <span className="waydee-cr-signal-track">
        {state === 'on' && <span className="waydee-cr-signal-fill" style={{ width: `${Math.round((value as number) * 100)}%` }} />}
      </span>
      <span className="waydee-cr-signal-value">
        {state === 'off' ? t('creators.notApplicable')
          : state === 'unknown' ? t('creators.unknownSignal')
            : Math.round((value as number) * 100)}
      </span>
    </div>
  )
}

/** Puan halkası: 0–100. ⚠️ Renk tek bir eşikle değil üç kademeyle — 59 ile 61'i farklı göstermek için değil, okunabilirlik için. */
function ScoreRing({ value }: { value: number }) {
  const r = 18
  const circumference = 2 * Math.PI * r
  const filled = (Math.max(0, Math.min(100, value)) / 100) * circumference
  const tone = value >= 70 ? 'high' : value >= 50 ? 'mid' : 'low'
  return (
    <svg viewBox="0 0 44 44" className="waydee-cr-ring" data-tone={tone} aria-hidden>
      <circle cx="22" cy="22" r={r} className="waydee-cr-ring-track" />
      <circle cx="22" cy="22" r={r} className="waydee-cr-ring-fill"
        strokeDasharray={`${filled} ${circumference}`} transform="rotate(-90 22 22)" />
      <text x="22" y="22" dy="0.35em" textAnchor="middle" className="waydee-cr-ring-text">
        {Math.round(value)}
      </text>
    </svg>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
