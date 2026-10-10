import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Telescope } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { useT } from '@/i18n'
import { apiErrorMessage } from '@/lib/api'
import { getCredits } from '@/lib/aiStudio'
import {
  DEFAULT_WEIGHTS,
  SIGNALS,
  addToShortlist,
  getCreatorConfig,
  getCreatorSearch,
  listCreatorSearches,
  listShortlist,
  removeFromShortlist,
  saveSearchWeights,
  startCreatorSearch,
  updateShortlistNote,
  type Creator,
  type SearchDetail,
  type Weights,
} from '@/lib/creators'
import { useI18nStore } from '@/stores/i18n'
import { CreditPill } from '@/features/ai/AiStudioPage'
import { Composer, EMPTY_DRAFT, validateDraft, type Draft } from './Composer'
import { ReportPanel } from './ReportPanel'
import { ReportsList } from './ReportsList'
import { ShortlistView } from './ShortlistView'

type Tab = 'discover' | 'reports' | 'shortlist'

const WEIGHTS_KEY = 'waydee-creator-weights'

/**
 * Son kullanılan ağırlıklar — yeni aramalar bunlarla başlar.
 * InfluSense: "Your settings are saved … and used when scoring future searches."
 * ⚠️ `localStorage` gizli pencerede ya da kapalı depolamada hata fırlatır;
 * okuma/yazma sarılıdır ve başarısızlık varsayılana düşer.
 */
function loadWeights(): Weights {
  try {
    const raw = localStorage.getItem(WEIGHTS_KEY)
    if (raw) return normalizeWeights(JSON.parse(raw))
  } catch {
    /* varsayılana düş */
  }
  return { ...DEFAULT_WEIGHTS }
}

function storeWeights(w: Weights) {
  try {
    localStorage.setItem(WEIGHTS_KEY, JSON.stringify(w))
  } catch {
    /* depolama kapalı — yalnız bu oturumda geçerli kalır */
  }
}

function normalizeWeights(raw: unknown): Weights {
  const out = { ...DEFAULT_WEIGHTS }
  if (raw && typeof raw === 'object') {
    for (const s of SIGNALS) {
      const v = (raw as Record<string, unknown>)[s]
      if (typeof v === 'number' && Number.isFinite(v)) out[s] = Math.max(0, Math.min(100, Math.round(v)))
    }
  }
  return out
}

/** Raporun filtrelerinden formu geri kurar ("aynı filtrelerle tekrar dene"). */
function draftFrom(search: SearchDetail): Draft {
  const f = search.filters
  return {
    brief: search.brief,
    platforms: f.platforms,
    tiers: f.tiers,
    categories: f.categories,
    formats: f.formats,
    country: f.country ?? '',
    language: f.language ?? '',
    gender: f.gender,
    minEngagementPct: f.minEngagementPct ?? 0,
    emergingOnly: f.emergingOnly,
    budget: f.budgetMax != null ? String(f.budgetMax) : '',
    currency: f.currency ?? 'TRY',
    brandSafe: f.brandSafe,
    resultCount: f.resultCount === 10 ? 10 : 5,
  }
}

/**
 * <b>Influencer keşfi</b> (V61, 108. tur).
 *
 * Kullanıcı talimatı: *"influsense.tech'teki özelliğin benzerini ve daha
 * gelişmiş hâlini kendi tasarımımızda yap — kullanıcılar ya da firmalar
 * filtreler girecek: hangi alanda video üretiyor, hangi kategoride, kaç
 * takipçisi olsun…"*
 *
 * <h3>InfluSense'ten alınanlar</h3>
 * düz dilde arama · platform/boyut/konum · şeffaf adımlar · ayarlanabilir
 * ağırlıklar (radar) · "neden bu sırada" açıklaması · kayıtlı raporlar ·
 * izleme listesi · dışa aktarma.
 *
 * <h3>Üstüne eklenenler</h3>
 * kategori/biçim/cinsiyet/etkileşim/bütçe/marka güvenliği filtreleri · iki
 * sağlayıcı ve otomatik yedekleme · her adayın okunan bir kaynağa bağlanması ve
 * <b>elenenlerin gerekçesiyle gösterilmesi</b> · ağırlık değişince sunucuya
 * gitmeden anında yeniden sıralama · beş dil.
 *
 * ⚠️ Sekme ve açık rapor ADRESTE (`?tab=…&r=<id>`): sayfa yenilenince ya da
 * bağlantı paylaşılınca aynı rapor açılır; süren bir araştırma yarıda kalmaz.
 */
export function CreatorsPage() {
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'reports' ? 'reports' : params.get('tab') === 'shortlist' ? 'shortlist' : 'discover'
  const reportId = params.get('r')

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [weights, setWeights] = useState<Weights>(loadWeights)
  const [savingId, setSavingId] = useState<string | null>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  const configQuery = useQuery({ queryKey: ['creator-config'], queryFn: getCreatorConfig, staleTime: 60_000 })
  const creditsQuery = useQuery({ queryKey: ['credits'], queryFn: getCredits })
  const historyQuery = useQuery({ queryKey: ['creator-searches'], queryFn: () => listCreatorSearches(30) })
  const shortlistQuery = useQuery({ queryKey: ['creator-shortlist'], queryFn: listShortlist })
  const searchQuery = useQuery({
    queryKey: ['creator-search', reportId],
    queryFn: () => getCreatorSearch(reportId as string),
    enabled: !!reportId,
    // Süren aramada adımlar canlı; bitince yoklama durur.
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'QUEUED' || s === 'RUNNING' ? 1500 : false
    },
  })
  const search = searchQuery.data

  /* Arama bitince: bakiye (sonuçsuz/başarısız aramada iade var) ve geçmiş tazelenir. */
  const lastStatus = useRef<string | undefined>(undefined)
  useEffect(() => {
    const status = search?.status
    if (lastStatus.current && lastStatus.current !== status && (status === 'SUCCEEDED' || status === 'FAILED')) {
      void qc.invalidateQueries({ queryKey: ['credits'] })
      void qc.invalidateQueries({ queryKey: ['creator-searches'] })
    }
    lastStatus.current = status
  }, [search?.status, qc])

  /* Rapor değişince ağırlıklar o raporunkine döner. ⚠️ Yalnız KİMLİK değişince:
     yoklama her 1,5 sn'de yeni bir nesne getirir ve kullanıcının o an
     sürüklediği ağırlıkları ezerdi. */
  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    if (search && loadedFor.current !== search.id) {
      loadedFor.current = search.id
      setWeights(normalizeWeights(search.weights))
    }
  }, [search])

  /* Ağırlıklar gecikmeli kaydedilir: sürükleme saniyede onlarca değişiklik üretir. */
  const weightsTimer = useRef<number | undefined>(undefined)
  const changeWeights = (next: Weights) => {
    setWeights(next)
    storeWeights(next)
    window.clearTimeout(weightsTimer.current)
    if (search?.status === 'SUCCEEDED') {
      const id = search.id
      weightsTimer.current = window.setTimeout(() => {
        saveSearchWeights(id, next).catch(() => {
          /* Kalıcılık hatası sıralamayı etkilemez; bir sonraki değişiklik yeniden dener. */
        })
      }, 700)
    }
  }
  useEffect(() => () => window.clearTimeout(weightsTimer.current), [])

  const config = configQuery.data
  const credits = creditsQuery.data
  const cost = config ? (draft.resultCount === 10 ? config.costLarge : config.costSmall) : 0

  const openReport = (id: string | null, nextTab: Tab = 'discover') => {
    const next = new URLSearchParams()
    if (nextTab !== 'discover') next.set('tab', nextTab)
    if (id) next.set('r', id)
    setParams(next)
  }

  const start = useMutation({
    mutationFn: (d: Draft) =>
      startCreatorSearch({
        brief: d.brief.trim(),
        platforms: d.platforms,
        tiers: d.tiers,
        categories: d.categories,
        formats: d.formats,
        country: d.country || null,
        language: d.language || null,
        gender: d.gender,
        minEngagementPct: d.minEngagementPct > 0 ? d.minEngagementPct : null,
        emergingOnly: d.emergingOnly,
        budgetMax: d.budget ? Number(d.budget) : null,
        currency: d.budget ? d.currency : null,
        brandSafe: d.brandSafe,
        resultCount: d.resultCount,
        weights,
        locale,
      }),
    onSuccess: (detail) => {
      qc.setQueryData(['creator-search', detail.id], detail)
      void qc.invalidateQueries({ queryKey: ['credits'] })
      void qc.invalidateQueries({ queryKey: ['creator-searches'] })
      openReport(detail.id)
      toast.success(t('creators.started'))
      // Mobilde rapor formun altında: kullanıcıyı adımların başladığı yere götür.
      window.setTimeout(() => {
        if (window.matchMedia('(max-width: 1023px)').matches) {
          reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 50)
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('creators.error.INTERNAL'))),
  })

  const save = useMutation({
    mutationFn: ({ searchId, creatorId }: { searchId: string; creatorId: string }) =>
      addToShortlist(searchId, creatorId),
    onMutate: ({ creatorId }) => setSavingId(creatorId),
    onSuccess: () => {
      toast.success(t('creators.savedToast'))
      void qc.invalidateQueries({ queryKey: ['creator-shortlist'] })
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('creators.error.INTERNAL'))),
    onSettled: () => setSavingId(null),
  })

  const note = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => updateShortlistNote(id, value),
    onSuccess: () => {
      toast.success(t('creators.noteSaved'))
      void qc.invalidateQueries({ queryKey: ['creator-shortlist'] })
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('creators.error.INTERNAL'))),
  })

  const remove = useMutation({
    mutationFn: (id: string) => removeFromShortlist(id),
    onSuccess: () => {
      toast.success(t('creators.removed'))
      void qc.invalidateQueries({ queryKey: ['creator-shortlist'] })
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('creators.error.INTERNAL'))),
  })

  const savedIds = useMemo(
    () => new Set((shortlistQuery.data ?? []).map((s) => `${s.platform}:${s.handle}`.toLowerCase())),
    [shortlistQuery.data],
  )

  const focusComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => document.getElementById('cr-brief')?.focus({ preventScroll: true }), 300)
  }

  const onSimilar = (c: Creator) => {
    setDraft({
      ...draft,
      brief: t('creators.similarBrief', {
        platform: t(`creators.platform.${c.platform}` as never),
        handle: c.handle,
        summary: c.summary || c.displayName,
      }).slice(0, 1500),
      platforms: [c.platform],
      country: c.country ?? draft.country,
      language: c.language ?? draft.language,
      categories: c.categories.slice(0, 5),
    })
    focusComposer()
  }

  const onRetry = () => {
    if (!search) return
    const d = draftFrom(search)
    setDraft(d)
    if (!validateDraft(d)) start.mutate(d)
  }

  const onNew = () => {
    openReport(null)
    focusComposer()
  }

  // 9 Eki 2026: plan değil bakiye belirler — "deneme" bandı artık gösterilmez.
  const trialActive = false

  return (
    <div className="waydee-creators mx-auto w-full max-w-6xl">
      {/* --- başlık + bakiye --- */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Telescope className="h-6 w-6 shrink-0 text-violet" />
            {t('creators.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t('creators.subtitle')}</p>
        </div>
        {credits && <CreditPill balance={credits.balance} perPeriod={credits.perPeriod} locale={locale} />}
      </div>

      {/* --- sekmeler --- */}
      <div className="waydee-ai-tabs mb-5" role="tablist" aria-label={t('creators.title')}>
        {([
          ['discover', t('creators.tabDiscover'), null],
          ['reports', t('creators.tabReports'), historyQuery.data?.length ?? null],
          ['shortlist', t('creators.tabShortlist'), shortlistQuery.data?.length ?? null],
        ] as const).map(([key, label, count]) => (
          /* ⚠️ Açık rapor sekme değişince adreste KALIR: Raporlar'a bakıp
             Keşfet'e dönen kullanıcı, bıraktığı raporu yeniden açmak zorunda kalmamalı. */
          <button key={key} type="button" role="tab" aria-selected={tab === key} className="waydee-ai-tab"
            onClick={() => openReport(reportId, key)}>
            {label}
            {count != null && count > 0 && <span className="waydee-cr-tab-count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'discover' && (
        <>
          {config && !config.available && (
            <div className="mb-5 rounded-2xl bg-surface p-6 text-center shadow-card">
              <h2 className="text-base font-bold">{t('creators.unavailableTitle')}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{t('creators.unavailableDesc')}</p>
            </div>
          )}
          {config?.available && credits && !credits.aiEnabled && (
            <div className="mb-5 rounded-2xl bg-surface p-6 text-center shadow-card">
              <h2 className="text-base font-bold">{t('creators.lockedTitle')}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{t('creators.lockedDesc')}</p>
              <Link to="/plan"
                className="mt-4 inline-flex h-11 items-center rounded-xl bg-ink px-6 text-sm font-semibold text-on-ink transition-opacity hover:opacity-90">
                {t('creators.lockedCta')}
              </Link>
            </div>
          )}
          {config?.available && trialActive && (
            <div className="mb-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl bg-subtle px-4 py-3 text-center text-sm">
              <span className="font-semibold text-ink">{t('creators.trialTitle')}</span>
              <span className="text-muted">{t('creators.trialDesc', { credits: (credits?.trialRemaining ?? 0).toLocaleString(locale) })}</span>
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <div ref={composerRef} className="scroll-mt-20">
              <Composer
                draft={draft}
                onChange={setDraft}
                onSubmit={() => start.mutate(draft)}
                submitting={start.isPending}
                locale={locale}
                cost={cost}
                balance={credits ? credits.balance : null}
                canUseAi={!!credits?.aiEnabled}
                available={!!config?.available}
              />
            </div>
            <div ref={reportRef} className="min-w-0 scroll-mt-20">
              <ReportPanel
                search={search}
                loading={!!reportId && searchQuery.isLoading}
                locale={locale}
                weights={weights}
                onWeightsChange={changeWeights}
                savedIds={savedIds}
                savingId={savingId}
                onSave={(c) => search && save.mutate({ searchId: search.id, creatorId: c.id })}
                onSimilar={onSimilar}
                onRetry={onRetry}
                onNew={onNew}
              />
            </div>
          </div>
        </>
      )}

      {tab === 'reports' && (
        <ReportsList items={historyQuery.data} loading={historyQuery.isLoading} locale={locale}
          onOpen={(id) => openReport(id)} />
      )}

      {tab === 'shortlist' && (
        <ShortlistView
          items={shortlistQuery.data}
          loading={shortlistQuery.isLoading}
          locale={locale}
          onNote={(id, value) => note.mutate({ id, value })}
          onRemove={(id) => remove.mutate(id)}
          onOpenReport={(id) => openReport(id)}
        />
      )}
    </div>
  )
}
