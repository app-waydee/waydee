import { useState } from 'react'
import { Check, Gift, RefreshCw, Sparkles, Store } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageSpinner, Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { api, apiErrorMessage } from '@/lib/api'
import { VerifiedTick } from '@/components/VerifiedTick'
import { fmtDate } from '@/lib/format'
import { usePlan, useRenewPlan, useUpgrade } from './PlanBadge'
import {
  formatPrice,
  monthlyOf,
  usePlanPricing,
  yearlyDiscount,
  yearlyTotal,
  type BillingPeriod,
  type PaidPlan,
  type PlanPricing,
} from './proPricing'
import { useT } from '@/i18n'
import { INCLUDES, PREMIUM_FEATURES, PRO_FEATURES } from './planFeatures'

/**
 * <b>Üyeliğim</b> (`/plan`).
 *
 * <p>🔴 <b>Neden eklendi:</b> kullanıcı tarafında plan yalnız iki küçük yüzeyde
 * görünüyordu — sekmelerin yanındaki rozet ve kota <b>dolduğunda</b> çıkan kart.
 * Yani kullanıcı hangi plandaysa neyi kaybettiğini/kazandığını, ücretin ne
 * olduğunu ve Pro'nun ne getirdiğini <b>hiçbir yerde bir arada göremiyordu</b>;
 * yükseltmenin tek yolu limite çarpmaktı.
 *
 * <p>🔴 <b>V37: iki plan, iki dönem.</b> Fiyat sunucudan gelir (yönetim
 * panelinden değişir) — koda gömülmez. Yükseltme yine <b>ödeme sayfasına</b>
 * gider: plan ancak imzalı webhook ile yükselir, istemci kendi kendine
 * yükselemez.
 *
 * <p>⚠️ Dönem anahtarı <b>tek</b> ve iki kartın üstünde durur. Kart başına
 * ayrı anahtar, kullanıcının iki kartı farklı dönemde karşılaştırmasına yol
 * açardı — "hangisi ucuz" sorusu anlamını yitirirdi.
 */
export function PlanPage() {
  const t = useT()
  const { data, isLoading } = usePlan()
  const upgrade = useUpgrade()
  const renew = useRenewPlan()
  const pricing = usePlanPricing()
  const [period, setPeriod] = useState<BillingPeriod>('YEARLY')

  if (isLoading || !data) return <PageSpinner label={t('feed.loading')} />

  const current = data.plan
  const paid = current !== 'FREE'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('plan.title')}</h1>

      {/* --- şu anki plan + bugünkü kullanım --- */}
      <div className="waydee-plan-panel mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">
              {current === 'PREMIUM'
                ? t('plan.premium')
                : current === 'PRO'
                  ? t('post.planPro')
                  : t('post.planFree')}
            </span>
            {paid && <VerifiedTick size={18} title={t('profile.verified')} />}
          </div>
          {paid && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted">
              <Sparkles className="h-4 w-4" /> {t('post.planUnlimited')}
            </span>
          )}
        </div>

        {/* 🔴 Üyelik SÜRELİDİR: bitiş tarihi görünür olmalı. Eskiden bir kez PRO
            olan sonsuza kadar PRO kalıyordu; artık kullanıcı ne zaman
            biteceğini ve hangi dönemde olduğunu ekranda görüyor. */}
        {paid && data.expiresAt && (
          <p className="mt-2 text-[13px] font-medium text-muted">
            {t('plan.renewsOn')}: <b className="text-ink">{fmtDate(data.expiresAt)}</b>
            {data.period === 'YEARLY' && <> · {t('plan.yearlyBilling')}</>}
          </p>
        )}

        {data.canOwnStore && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted">
            <Store className="h-4 w-4" /> {t('plan.storeIncluded')}
          </p>
        )}

        {/*
          ---- ÜYELİĞİMİ YENİLE (25 Ağu 2026) ----

          🔴 Koşul `renewablePlan`, `paid` DEĞİL. `paid` etkin plana bakar ve
          üyeliği <b>bitmiş</b> kullanıcıda false olur — oysa yenile düğmesine
          en çok ihtiyacı olan kişi odur. Bu yüzden sunucu son ödenen planı
          ayrı bir alanda gönderiyor.

          ⚠️ Cümle iki durumda farklı: üyelik sürüyorsa "bir dönem daha ekle",
          bitmişse "yeniden başlat". Aynı metni kullanmak, süresi dolmuş
          kullanıcıya hâlâ üyeymiş gibi hissettirirdi.
        */}
        {data.renewablePlan && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button
              variant={paid ? 'stroke' : 'primary'}
              onClick={() => renew.mutate()}
              disabled={renew.isPending}
              className="h-11"
            >
              <RefreshCw className={`h-4 w-4 ${renew.isPending ? 'animate-spin' : ''}`} />
              {t('plan.renewNow')}
            </Button>
            <p className="text-[12.5px] font-medium leading-snug text-muted">
              {paid ? t('plan.renewHelpActive') : t('plan.renewHelpLapsed')}
            </p>
          </div>
        )}

        {/* ⚠️ Sayaç yalnız ücretsiz planda anlamlı — ücretli planda sınır yok. */}
        {!paid && (
          <>
            <div className="mt-3 flex items-baseline justify-between text-[13px] font-medium text-muted">
              <span>
                {t('post.planThisWeek')} {data.postsThisWeek}/{data.weeklyPosts}
              </span>
              <span>
                {t('plan.tagsPerPost')}: {data.tagsPerPost}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
              <div
                className="h-full bg-ink"
                style={{
                  width: `${Math.min(100, (data.postsThisWeek / Math.max(data.weeklyPosts, 1)) * 100)}%`,
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* --- dönem anahtarı --- */}
      <div className="mt-5 flex justify-center">
        <div className="waydee-period-switch" role="tablist" aria-label={t('plan.billingPeriod')}>
          <button
            type="button"
            role="tab"
            aria-selected={period === 'MONTHLY'}
            className={period === 'MONTHLY' ? 'is-active' : ''}
            onClick={() => setPeriod('MONTHLY')}
          >
            {t('plan.monthlyTab')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={period === 'YEARLY'}
            className={period === 'YEARLY' ? 'is-active' : ''}
            onClick={() => setPeriod('YEARLY')}
          >
            {t('plan.yearlyTab')}
            {pricing && yearlyDiscount(pricing, 'PREMIUM') > 0 && (
              <span className="waydee-period-save">
                −%{yearlyDiscount(pricing, 'PREMIUM')}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* --- planlar --- */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <PlanCard
          plan="PRO"
          period={period}
          pricing={pricing}
          current={current}
          onPick={() => upgrade.mutate({ plan: 'PRO', period })}
          busy={upgrade.isPending}
        />
        <PlanCard
          plan="PREMIUM"
          period={period}
          pricing={pricing}
          current={current}
          onPick={() => upgrade.mutate({ plan: 'PREMIUM', period })}
          busy={upgrade.isPending}
          highlight
        />
      </div>

      {/* --- paket kodu --- */}
      <RedeemBox />

      <p className="mt-3 text-xs font-medium text-faint">{t('plan.monthly')}</p>
      <p className="mt-1 text-xs font-medium text-faint">{t('plan.mapNote')}</p>
    </div>
  )
}

/**
 * <b>Paket kodu kutusu</b> (V40).
 *
 * <p>🔴 Kuponlar artık indirim değil <b>hediye</b>: yönetici "PREMIUM · yıllık"
 * içerikli bir kod üretir, kullanıcı buraya girer ve planı <b>anında</b>
 * yükselir — ödeme sayfasına hiç gidilmez.
 *
 * <p>⚠️ Başarıdan sonra plan sorgusu <b>tazelenir</b>: rozet, kota kartı ve
 * mağaza hakkı hep aynı yanıttan besleniyor; tazelenmezse kullanıcı planının
 * değiştiğini ancak sayfayı yenileyince görürdü.
 */
function RedeemBox() {
  const t = useT()
  const qc = useQueryClient()
  const [code, setCode] = useState('')

  const redeem = useMutation({
    mutationFn: async () =>
      (await api.post<{ plan: string; period: string }>('/coupons/redeem', { code: code.trim() }))
        .data,
    onSuccess: (res) => {
      setCode('')
      toast.success(t('plan.codeApplied', { plan: res.plan }))
      void qc.invalidateQueries({ queryKey: ['my-plan'] })
      void qc.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('plan.codeFailed'))),
  })

  return (
    <div className="waydee-plan-panel mt-4">
      <p className="text-[15px] font-bold">{t('plan.codeTitle')}</p>
      <p className="mt-0.5 text-[13px] font-medium text-muted">{t('plan.codeHelp')}</p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim()) redeem.mutate()
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t('plan.codePlaceholder')}
          maxLength={40}
          autoComplete="off"
          className="h-11 min-w-[12rem] flex-1 font-mono tracking-wider"
        />
        <Button type="submit" disabled={!code.trim() || redeem.isPending} className="h-11">
          {redeem.isPending ? <Spinner className="border-on-ink/30 border-t-on-ink" /> : <Gift className="h-4 w-4" />}
          {t('plan.codeApply')}
        </Button>
      </form>
    </div>
  )
}

/**
 * Tek plan kartı.
 *
 * <p>⚠️ Yıllık seçiliyken <b>iki sayı birden</b> yazılır: büyük olan aylık
 * eşdeğer ("10 $/ay"), altındaki yıllık tahsilat ("yıllık 120 $"). Yalnız
 * aylığı yazmak, kullanıcının kartından 12 katının çekileceğini ödeme
 * sayfasında öğrenmesi demek olurdu.
 */
function PlanCard({
  plan,
  period,
  pricing,
  current,
  onPick,
  busy,
  highlight,
}: {
  plan: PaidPlan
  period: BillingPeriod
  pricing: PlanPricing | null
  current: string
  onPick: () => void
  busy: boolean
  highlight?: boolean
}) {
  const t = useT()
  const isCurrent = current === plan
  const monthly = pricing ? monthlyOf(pricing, plan, period) : null
  /* 🔴 Liste TEK KAYNAKTAN gelir (`planFeatures.ts`). Burada elle yazılıyordu
     ve tanıtım sayfasındaki listeyle ayrışmıştı: Pro, Premium'dan zengin
     görünüyordu ve mavi tik iki farklı cümleyle yazılmıştı. */
  const features = (plan === 'PREMIUM' ? PREMIUM_FEATURES : PRO_FEATURES).map((k) => t(k))
  const includes = t(plan === 'PREMIUM' ? INCLUDES.PREMIUM : INCLUDES.PRO)

  return (
    <div className={`waydee-plan-panel flex flex-col ${highlight ? 'waydee-plan-featured' : ''}`}>
      <div>
        <p className="text-lg font-bold">
          {plan === 'PREMIUM' ? t('plan.premium') : t('landing.pricing.pro')}
        </p>
        <p className="text-[13px] font-medium text-muted">
          {plan === 'PREMIUM' ? t('plan.premiumDesc') : t('landing.pricing.proDesc')}
        </p>
      </div>

      <p className="mt-3 text-3xl font-bold tracking-tighter">
        {monthly != null && pricing ? (
          formatPrice(monthly, pricing.currency)
        ) : (
          <span className="inline-block h-7 w-16 rounded bg-subtle align-middle" />
        )}
        <span className="ms-1 text-sm font-normal text-muted">{t('landing.pricing.monthly')}</span>
      </p>
      {period === 'YEARLY' && pricing && (
        <p className="mt-0.5 text-[13px] font-medium text-muted">
          {t('plan.billedYearly')} {formatPrice(yearlyTotal(pricing, plan), pricing.currency)}
        </p>
      )}

      {/* ⚠️ "Öncekinin hepsi, artı:" satırı listenin ÜSTÜNDE durur — merdiven
          kuralı görünür olmazsa üst plan eksik görünür (yaşandı). */}
      <p className="mt-4 text-[13px] font-semibold text-muted">{includes}</p>
      <ul className="mt-2 flex-1 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[14px]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* ⚠️ Mevcut plana da düğme çizilir — ama "yenile" olarak. Üyelik süreli
          olduğu için yenileme gerçek bir eylemdir; sunucu kalan süreyi
          KAYBETMEZ, yeni dönemi mevcut bitişin üstüne ekler. */}
      <button
        type="button"
        className={`waydee-pill mt-4 w-full justify-center ${
          highlight ? 'waydee-pill-violet-solid' : 'waydee-pill-outline'
        }`}
        onClick={onPick}
        disabled={busy}
      >
        {/* 🔴 Metin PLANA GÖRE değişir. Eskiden her kartta `post.planUpgrade`
            yazıyordu ve o dize "Pro'ya geç" — yani PREMIUM kartının altında da
            "Pro'ya geç" görünüyordu. */}
        {isCurrent
          ? t('plan.renew')
          : plan === 'PREMIUM'
            ? t('plan.switchPremium')
            : t('plan.switchPro')}
      </button>
    </div>
  )
}
