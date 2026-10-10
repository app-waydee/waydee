import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Search } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Dropdown } from '@/components/ui/dropdown'
import { useT } from '@/i18n'
import {
  CATEGORIES,
  CURRENCIES,
  FORMATS,
  PLATFORMS,
  TIERS,
  type ContentFormat,
  type CreatorCategory,
  type Currency,
  type Gender,
  type Platform,
  type SizeTier,
} from '@/lib/creators'
import { tierRange } from './creatorFormat'
import { countryOptions, languageOptions } from './options'
import { PlatformIcon } from './PlatformIcon'

/** Formun durumu. ⚠️ Metin alanları metin olarak tutulur; sayıya çevirme gönderimde. */
export interface Draft {
  brief: string
  platforms: Platform[]
  tiers: SizeTier[]
  categories: CreatorCategory[]
  formats: ContentFormat[]
  country: string
  language: string
  gender: Gender
  minEngagementPct: number
  emergingOnly: boolean
  budget: string
  currency: Currency
  brandSafe: boolean
  resultCount: 5 | 10
}

export const EMPTY_DRAFT: Draft = {
  brief: '',
  platforms: ['INSTAGRAM', 'TIKTOK'],
  tiers: [],
  categories: [],
  formats: [],
  country: '',
  language: '',
  gender: 'ANY',
  minEngagementPct: 0,
  emergingOnly: false,
  budget: '',
  currency: 'TRY',
  brandSafe: false,
  resultCount: 5,
}

const MAX_CATEGORIES = 5
const BRIEF_MIN = 10
const BRIEF_MAX = 1500

export function validateDraft(d: Draft): 'needBrief' | 'needPlatform' | null {
  if (d.brief.trim().length < BRIEF_MIN) return 'needBrief'
  if (d.platforms.length === 0) return 'needPlatform'
  return null
}

/**
 * <b>Arama oluşturucu</b> (108. tur) — stüdyonun ayar paneliyle aynı dil
 * (`waydee-ai-panel` · `-section` · `-label` · `-seg` · `-costline` · `-go`).
 *
 * ⚠️ Gelişmiş filtreler varsayılan KAPALI ama bir değer seçiliyse açık gelir:
 * kapalı bir bölümün içinde etkin bir filtre, "neden bu sonuçlar az?"
 * sorusunun görünmeyen cevabı olurdu.
 */
export function Composer({
  draft,
  onChange,
  onSubmit,
  submitting,
  locale,
  cost,
  balance,
  canUseAi,
  available,
}: {
  draft: Draft
  /** ⚠️ Fonksiyonel güncelleme alır — art arda iki değişiklik birbirini ezmesin (bkz. WeightsRadar). */
  onChange: Dispatch<SetStateAction<Draft>>
  onSubmit: () => void
  submitting: boolean
  locale: string
  cost: number
  balance: number | null
  canUseAi: boolean
  available: boolean
}) {
  const t = useT()
  const [showErrors, setShowErrors] = useState(false)
  const hasAdvanced = draft.gender !== 'ANY' || draft.minEngagementPct > 0 || draft.budget !== ''
    || draft.emergingOnly || draft.brandSafe
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvanced)

  const countries = useMemo(
    () => [{ value: '', label: t('creators.any') }, ...countryOptions(locale)],
    [locale, t],
  )
  const languages = useMemo(
    () => [{ value: '', label: t('creators.any') }, ...languageOptions(locale)],
    [locale, t],
  )

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => onChange((prev) => ({ ...prev, [key]: value }))

  type ListKey = 'platforms' | 'tiers' | 'categories' | 'formats'
  /** Çoklu seçimde aç/kapa — ⚠️ listenin ÖNCEKİ hâlinden hesaplanır, kapanıştaki `draft`'tan değil. */
  const flip = <K extends ListKey>(key: K, value: Draft[K][number]) =>
    onChange((prev) => {
      const list = prev[key] as Draft[K][number][]
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
      // Kategori tavanı burada da korunur: düğme kapalıyken klavyeyle tetiklense bile aşılmasın.
      if (key === 'categories' && next.length > MAX_CATEGORIES) return prev
      return { ...prev, [key]: next }
    })

  const error = validateDraft(draft)
  const insufficient = balance != null && balance < cost
  const disabled = submitting || !available || !canUseAi || insufficient

  const submit = () => {
    if (error) {
      setShowErrors(true)
      return
    }
    onSubmit()
  }

  return (
    <div className="waydee-ai-panel">
      {/* ------------------------------------------------------------ brief */}
      <section className="waydee-ai-section">
        <label htmlFor="cr-brief" className="waydee-ai-label">{t('creators.briefLabel')}</label>
        <textarea
          id="cr-brief"
          value={draft.brief}
          onChange={(e) => set('brief', e.target.value.slice(0, BRIEF_MAX))}
          placeholder={t('creators.briefPlaceholder')}
          rows={4}
          className="waydee-cr-brief"
          aria-invalid={showErrors && error === 'needBrief'}
        />
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className="waydee-cr-hint">
            {showErrors && error === 'needBrief'
              ? <span className="text-danger">{t('creators.needBrief')}</span>
              : t('creators.briefHint')}
          </p>
          <span className="waydee-cr-count">{draft.brief.length.toLocaleString(locale)}/{BRIEF_MAX.toLocaleString(locale)}</span>
        </div>
        <div className="mt-3">
          <span className="waydee-cr-mini">{t('creators.examples')}</span>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {(['example1', 'example2', 'example3'] as const).map((key) => (
              <button key={key} type="button" className="waydee-cr-example"
                onClick={() => set('brief', t(`creators.${key}`))}>
                {t(`creators.${key}`)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- platformlar */}
      <section className="waydee-ai-section">
        <span className="waydee-ai-label">{t('creators.platforms')}</span>
        <div className="waydee-cr-chips" role="group" aria-label={t('creators.platforms')}>
          {PLATFORMS.map((p) => (
            <button key={p} type="button" className="waydee-cr-chip" aria-pressed={draft.platforms.includes(p)}
              onClick={() => flip('platforms', p)}>
              <PlatformIcon platform={p} className="h-3.5 w-3.5" />
              {t(`creators.platform.${p}` as never)}
            </button>
          ))}
        </div>
        {showErrors && error === 'needPlatform' && (
          <p className="waydee-cr-hint mt-1.5 text-danger">{t('creators.needPlatform')}</p>
        )}
      </section>

      {/* ------------------------------------------------------------ boyut */}
      <section className="waydee-ai-section">
        <span className="waydee-ai-label">{t('creators.size')}</span>
        <div className="waydee-cr-chips" role="group" aria-label={t('creators.size')}>
          {TIERS.map((tier) => (
            <button key={tier} type="button" className="waydee-cr-chip waydee-cr-chip-tier"
              aria-pressed={draft.tiers.includes(tier)} onClick={() => flip('tiers', tier)}>
              <span>{t(`creators.tier.${tier}` as never)}</span>
              <span className="waydee-cr-chip-sub">{tierRange(tier, locale)}</span>
            </button>
          ))}
        </div>
        {draft.tiers.length === 0 && <p className="waydee-cr-hint mt-1.5">{t('creators.sizeAny')}</p>}
      </section>

      {/* -------------------------------------------------------- kategoriler */}
      <section className="waydee-ai-section">
        <div className="mb-2.5 flex items-baseline justify-between">
          <span className="waydee-ai-label-inline">{t('creators.categories')}</span>
          <span className="waydee-cr-count">
            {draft.categories.length}/{MAX_CATEGORIES} · {t('creators.categoriesHint')}
          </span>
        </div>
        <div className="waydee-cr-chips" role="group" aria-label={t('creators.categories')}>
          {CATEGORIES.map((cat) => {
            const on = draft.categories.includes(cat)
            const full = !on && draft.categories.length >= MAX_CATEGORIES
            return (
              <button key={cat} type="button" className="waydee-cr-chip" aria-pressed={on} disabled={full}
                title={full ? t('creators.maxCategories') : undefined}
                onClick={() => flip('categories', cat)}>
                {t(`creators.cat.${cat}` as never)}
              </button>
            )
          })}
        </div>
      </section>

      {/* ----------------------------------------------------------- biçimler */}
      <section className="waydee-ai-section">
        <span className="waydee-ai-label">{t('creators.formats')}</span>
        <div className="waydee-cr-chips" role="group" aria-label={t('creators.formats')}>
          {FORMATS.map((f) => (
            <button key={f} type="button" className="waydee-cr-chip" aria-pressed={draft.formats.includes(f)}
              onClick={() => flip('formats', f)}>
              {t(`creators.fmt.${f}` as never)}
            </button>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ konum ve dil */}
      <section className="waydee-ai-section">
        <div className="waydee-ai-duo">
          <Dropdown label={t('creators.country')} value={draft.country} options={countries} scrollable
            onChange={(v) => set('country', v)} />
          <Dropdown label={t('creators.language')} value={draft.language} options={languages} scrollable
            onChange={(v) => set('language', v)} />
        </div>
      </section>

      {/* ----------------------------------------------------------- gelişmiş */}
      <section className="waydee-ai-section">
        <button type="button" className="waydee-cr-disclosure" aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}>
          <span className="waydee-ai-label-inline">{t('creators.advanced')}</span>
          {hasAdvanced && <span className="waydee-cr-dot" aria-hidden />}
          <ChevronDown className={`ms-auto h-4 w-4 text-muted transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
        </button>

        {advancedOpen && (
          <div className="mt-4 space-y-4">
            <div>
              <span className="waydee-ai-label">{t('creators.gender')}</span>
              <div className="waydee-ai-seg" role="radiogroup" aria-label={t('creators.gender')}>
                {(['ANY', 'FEMALE', 'MALE'] as const).map((g) => (
                  <button key={g} type="button" role="radio" aria-checked={draft.gender === g}
                    className="waydee-ai-seg-item" onClick={() => set('gender', g)}>
                    {t(`creators.genderOpt.${g}` as never)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="waydee-ai-slider-row">
                <span className="waydee-ai-label-inline">{t('creators.minEngagement')}</span>
                <span className="waydee-ai-slider-value">
                  {draft.minEngagementPct === 0
                    ? t('creators.engagementAny')
                    : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
                      .format(draft.minEngagementPct / 100)}
                </span>
              </div>
              <input type="range" min={0} max={10} step={0.5} value={draft.minEngagementPct}
                onChange={(e) => set('minEngagementPct', Number(e.target.value))}
                className="waydee-range mt-2 w-full" aria-label={t('creators.minEngagement')}
                style={{ ['--fill' as string]: `${draft.minEngagementPct * 10}%` }} />
            </div>

            <div>
              <span className="waydee-ai-label">{t('creators.budget')}</span>
              <div className="waydee-cr-budget">
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.budget}
                  // Yalnız rakam — "5.000" yazan kullanıcının noktası sessizce atılır.
                  onChange={(e) => set('budget', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder={t('creators.budgetPlaceholder')}
                  className="waydee-cr-input"
                  aria-label={t('creators.budget')}
                />
                <Dropdown label={t('creators.currency')} value={draft.currency}
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  onChange={(v) => set('currency', v)} />
              </div>
              <p className="waydee-cr-hint mt-1.5">{t('creators.budgetHint')}</p>
            </div>

            <Toggle on={draft.emergingOnly} onChange={(v) => set('emergingOnly', v)}
              title={t('creators.emerging')} desc={t('creators.emergingDesc')} />
            <Toggle on={draft.brandSafe} onChange={(v) => set('brandSafe', v)}
              title={t('creators.brandSafe')} desc={t('creators.brandSafeDesc')} />
          </div>
        )}
      </section>

      {/* --------------------------------------------------- sayı + maliyet */}
      <section className="waydee-ai-section">
        <span className="waydee-ai-label">{t('creators.resultCount')}</span>
        <div className="waydee-ai-seg mb-3" role="radiogroup" aria-label={t('creators.resultCount')}>
          {([5, 10] as const).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={draft.resultCount === n}
              className="waydee-ai-seg-item" onClick={() => set('resultCount', n)}>
              {n.toLocaleString(locale)}
            </button>
          ))}
        </div>

        <div className="waydee-ai-costline mb-2.5">
          <span>
            {t('creators.costLine')} · {t('creators.costValue', { credits: cost.toLocaleString(locale) })}
          </span>
          {balance != null && (
            <span className={`waydee-ai-costline-muted ${insufficient ? 'text-danger' : ''}`}>
              {t('creators.balance', { credits: balance.toLocaleString(locale) })}
            </span>
          )}
        </div>

        <button type="button" className="waydee-ai-go" disabled={disabled} onClick={submit}>
          {/* ⚠️ Koyu düğmede spinner `on-ink` (vault altın kuralı) — varsayılan
              `border-t-accent` mürekkep zeminde kaybolurdu. */}
          {submitting ? <Spinner className="h-4 w-4 border-on-ink/30 border-t-on-ink" /> : <Search className="h-4 w-4" />}
          {submitting ? t('creators.going') : t('creators.go')}
        </button>
        {insufficient && canUseAi && available && (
          <p className="waydee-cr-hint mt-2 text-center">
            {t('creators.notEnough')} · <Link to="/plan" className="font-semibold text-ink underline">{t('creators.lockedCta')}</Link>
          </p>
        )}
      </section>
    </div>
  )
}

function Toggle({ on, onChange, title, desc }: { on: boolean; onChange: (v: boolean) => void; title: string; desc: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="waydee-cr-toggle" onClick={() => onChange(!on)}>
      <span className="min-w-0 flex-1 text-start">
        <span className="waydee-cr-toggle-title">{title}</span>
        <span className="waydee-cr-toggle-desc">{desc}</span>
      </span>
      <span className="waydee-cr-switch" aria-hidden />
    </button>
  )
}
